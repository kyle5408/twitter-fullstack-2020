const helpers = require('./_helpers')
const express = require('express')
const app = express()
const exhbs = require('express-handlebars')
const bodyParser = require('body-parser')
const methodOverride = require('method-override')
const flash = require('connect-flash')
const session = require('express-session')
const axios = require('axios');
const http = require('http')
const server = http.createServer(app)
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });


const port = process.env.PORT || 3000
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}



//變更順序以引入變數
const passport = require('./config/passport')
const messageController = require('./controllers/messageController')
const { sendMsg } = require('./controllers/messageController')
const { join } = require('path')


app.engine('hbs', exhbs({ defaultLayout: 'main', helpers: require('./config/handlebars-helpers'), extname: '.hbs' }))
app.set('view engine', 'hbs')

app.use('/upload', express.static(__dirname + '/upload'))
app.use(express.static(__dirname + '/public'))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }))
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())
app.use(methodOverride('_method'))

let onlineUser = []
io.on('connection', (socket) => {
  socket.on('send user', function (currentName, currentAccount, currentAvatar, currentId) {
    socket.broadcast.emit('new user msg', currentName, currentAccount, currentAvatar, currentId)
    onlineUser.push({ currentName, currentAccount, currentAvatar, currentId})

    socket.on('chat message', (msg, currentId, currentAvatar) => {
      const user = { id: currentId, msg: msg }
      messageController.sendMsg(user)
      io.emit('chat message', msg, currentId, currentAvatar);
    });

    socket.on('onlineUser', () => {
      io.emit('online user', onlineUser)
    })

    socket.on('disconnect', () => {
      //移除使用者名單
      const remove = { currentName, currentAccount, currentAvatar }
      onlineUser = onlineUser.filter(item => {
        return item.currentAccount !== remove.currentAccount
      })
      socket.broadcast.emit('user offline', currentName)
      io.emit('online user', onlineUser)
    })
  });

  //私人聊天
  socket.on('join private room', (roomName) => {
    socket.join(roomName);

    socket.on('private-chat', (msg, currentId, currentAvatar, viewUserId) => {
      //存進資料庫
      const user = { id: currentId, msg: msg }
      messageController.sendMsg(user, roomName, viewUserId)
      socket.to(roomName).emit('private chat message', msg, currentId, currentAvatar);
      socket.broadcast.to(roomName).emit('noteHer');
    })

    //每位使用者最後訊息
    socket.on('msg-inbox', async (currentId) => {
      const msgInbox = await messageController.getPrivateInbox(currentId)
      // console.log('msg',msgInbox)
      io.emit('renderMsgBox', msgInbox)
    })
  })




});






app.use((req, res, next) => {
  res.locals.success_messages = req.flash('success_messages')
  res.locals.error_messages = req.flash('error_messages')
  res.locals.user = helpers.getUser(req)
  next()
})

server.listen(port, () => console.log(`Example app listening on http://localhost:${port}`))

// const routes = require('./routes')
// app.use(routes)



require('./routes')(app)



module.exports = app
