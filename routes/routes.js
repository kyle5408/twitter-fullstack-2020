const helpers = require('../_helpers')
const express = require('express')
const router = express.Router()
const passport = require('../config/passport')
const userController = require('../controllers/userController')
const tweetController = require('../controllers/tweetController')
const adminController = require('../controllers/adminController')
const messageController = require('../controllers/messageController')

const multer = require('multer')
const upload = multer({ dest: 'temp/' })
const multipleUpload = upload.fields([{ name: 'avatar' }, { name: 'cover' }])


const authenticated = (req, res, next) => {
  if (helpers.ensureAuthenticated(req)) {
    if (helpers.getUser(req).role !== 'admin' || !helpers.getUser(req).role) {
      return next()
    }
    if (helpers.getUser(req).role === 'admin') {
      req.flash('error_messages', '管理者無法使用前台頁面')
      return res.redirect('/admin/tweets')
    }
  }
  req.flash('error_messages', '請先登入')
  res.redirect('/signin')
}

const authenticatedAdmin = (req, res, next) => {
  if (helpers.ensureAuthenticated(req)) {
    if (helpers.getUser(req).role === "admin") {
      return next()
    } else {
      req.flash('error_messages', '請確認使用者身分')
      return res.redirect('/admin/signin')
    }
  }
  req.flash('error_messages', '請先登入')
  res.redirect('/admin/signin')
}



//如果使用者訪問首頁，就導向 /tweets 的頁面
// router.get('/', authenticated, (req, res) => res.render('public-chat', { currentUser: req.user }))
router.get('/', authenticated, (req, res) => res.redirect('/tweets'))
//使用者顯示特定使用者頁面(使用者所有貼文)
router.get('/users/:id/tweets', authenticated, userController.getUserTweets)
//使用者所有喜歡貼文
router.get('/users/:id/likes', authenticated, userController.getUserLikes)
//使用者所有回覆
router.get('/users/:id/replied', authenticated, userController.getUserReplied)
//使用者追蹤清單
router.get('/users/:id/followings', authenticated, userController.getUserFollowings)
//使用者粉絲清單(被追蹤)
router.get('/users/:id/followers', authenticated, userController.getUserFollowers)

//追蹤使用者
router.post('/followships', authenticated, userController.addFollowing)
//取消追蹤使用者
router.delete('/followships/:id', authenticated, userController.removeFollowing)

//顯示所有貼文(要改api)
router.get('/tweets', authenticated, tweetController.getTweets)

//使用者新增一則貼文
router.post('/tweets', authenticated, tweetController.postTweets)

//顯示特定貼文
router.get('/tweets/:id', authenticated, tweetController.getTweet)

// 回文相關
//顯示特定貼文回覆 (row40)
router.get('/tweets/:id/replies', authenticated, tweetController.getTweet)
//回覆特定貼文 (row 36)
router.post('/tweets/:id/replies', authenticated, tweetController.createReply)
//------------擴充功能--------------//
// 編輯貼文回覆 (row 37-38)
// router.get('/replies/:id/edit', tweetController.getReplyPage)
// router.put('/replies/:id', tweetController.putReply)
// 刪除回覆 (row 39)
// router.delete('/replies/:id', tweetController.removeReply)
// 編輯貼文 (row 33-34)
// router.get('/tweets/:id/edit', tweetController.editTweet)
// router.put('/tweets/:id', tweetController.putTweet)
// 刪除貼文 (row 35)
// router.delete('/tweets/:id', tweetController.removeTweet)
//------------------------------//

//喜歡特定貼文
router.post('/tweets/:id/like', authenticated, tweetController.addLike)
//取消喜歡特定貼文
router.post('/tweets/:id/unlike', authenticated, tweetController.removeLike)

//管理者登入(後台登入)
router.get('/admin/signin', adminController.signinPage)
router.post('/admin/signin', passport.authenticate('local', {
  failureRedirect: '/admin/signin',
  failureFlash: true
}), adminController.signin)
//後台登出
router.get('/admin/logout', authenticatedAdmin, adminController.logout)
//管理者顯示所有貼文
router.get('/admin/tweets', authenticatedAdmin, adminController.getTweets)
//管理者刪除貼文
router.delete('/admin/tweets/:id', authenticatedAdmin, adminController.deleteTweets)
//管理者顯示所有使用者
router.get('/admin/users', authenticatedAdmin, adminController.getUsers)


//使用者登入頁面
router.get('/signin', userController.signInPage)
router.post('/signin', passport.authenticate('local', { failureRedirect: '/signin', failureFlash: true }), userController.signIn)

//使用者編輯帳號設定(setting)
router.get('/users/:id/setting', authenticated, userController.getUserSetting)
router.put('/users/:id/setting', authenticated, userController.putUserSetting)

//使用者編輯個人資料(edit)
router.put('/users/:id/edit', authenticated, multipleUpload, userController.putUserEdit)

//即時通訊(公開聊天)
router.get('/messages', authenticated, messageController.publicPage);

//即時通訊(私人聊天)
router.get('/messages/:id', authenticated, messageController.privatePage)

//通知頁面
router.get('/subscribe/:id', authenticated, messageController.subscribe)
//新增訂閱
router.post('/subscribe/:id', authenticated, messageController.subscription)
//取消訂閱
router.delete('/subscribe/:id', authenticated, messageController.removeSubscribe)

//註冊
router.get('/signup', userController.signUpPage)
router.post('/signup', userController.signUp)
//登出
router.get('/logout', userController.logout)

module.exports = router


