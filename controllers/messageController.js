const helpers = require('../_helpers')
const express = require('express')
const app = express()
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });
const db = require('../models')
const Message = db.Message
const User = db.User
const Followship = db.Followship
const Tweet = db.Tweet
const Like = db.Like
const Reply = db.Reply
const Subscribe = db.Subscribe
const { sequelize } = require('../models');
const { render } = require('../app');
const { Op } = require("sequelize")

const messageController = {
  publicPage: (req, res) => {
    const currentUser = helpers.getUser(req)
    Message.findAll({
      where: { roomName: null },
      include: [{ model: User, attributes: ['id', 'avatar', 'name', 'account'] }],
      order: [['createdAt', 'ASC']],
    })
      .then(msg => {
        msg = msg.map(d => ({
          ...d.dataValues,
          User: d.User.dataValues,
          selfMsg: Boolean(d.UserId === currentUser.id)
        }))
        return res.render('public-chat', { currentUser, msg })
      })

  },
  sendMsg: (user, roomName, viewUserId) => {
    return Message.create({
      UserId: user.id,
      content: user.msg,
      roomName,
      toId: viewUserId
    })
  },

  privatePage: async (req, res) => {
    const currentUser = helpers.getUser(req)
    const currentUserId = Number(helpers.getUser(req).id)
    const viewUserId = Number(req.params.id)
    let roomName = currentUserId > viewUserId ? `${viewUserId}-${currentUserId}` : `${currentUserId}-${viewUserId}`

    //   return Promise.all([
    //     //搜尋全部歷史訊息
    //     Message.findAll({
    //       where: { roomName: roomName },
    //       include: [{ model: User, attributes: ['id', 'avatar', 'name', 'account'] }],
    //       order: [['createdAt', 'ASC']],
    //     }),
    //     //接收訊者的資料
    //     User.findOne({
    //       where: { id: viewUserId },
    //       attributes: ['id', 'name', 'avatar', 'account']
    //     })
    //   ])

    //     // userList.push(currentUserId.toString()"="viewUserId)
    //     // console.log(userList) 
    //     .then(([msg, viewUser]) => {
    //       viewUser = viewUser.toJSON()
    //       msg = msg.map(d => ({
    //         ...d.dataValues,
    //         User: d.User.dataValues,
    //         selfMsg: Boolean(d.UserId === currentUser.id)
    //       }))
    //       // console.log('私人訊息篩選====', msg[0])
    //       return res.render('private-chat', { roomName, currentUser, msg, viewUser })
    //     })
    // },

    //搜尋全部歷史訊息
    const msgs = await Message.findAll({
      where: { roomName: roomName },
      include: [{ model: User, attributes: ['id', 'avatar', 'name', 'account'] }],
      order: [['createdAt', 'ASC']],
    })
    //接收訊者的資料
    const viewUser = await User.findOne({
      where: { id: viewUserId },
      attributes: ['id', 'name', 'avatar', 'account'],
      raw: true,
      nest: true
    })
    console.log('viewUser==========', viewUser)
    msg = await msgs.map(d => ({
      ...d.dataValues,
      User: d.User.dataValues,
      selfMsg: Boolean(d.UserId === currentUser.id)
    }))
    return res.render('private-chat', { roomName, currentUser, msg, viewUserId, viewUser })
  },


  getPrivateInbox: async (currentId, res, cb) => {
    console.log('資料庫前條件', currentId)
    const toId = currentId
    // const rawData = await sequelize.query("SELECT * FROM `Message` ORDER BY `createdAt` DESC", { type: sequelize.QueryTypes.SELECT, raw: true, nest: true })
    const datas = await Message.findAll({
      include: [
        { model: User, attributes: ['id', 'avatar', 'name', 'account'] },
      ],
      // order: sequelize.query('select from Message order by createdAt desc', {
      //   type: sequelize.QueryTypes.SELECT
      // }),
      group: ['roomName'],
      raw: true,
      nest: true
    })
    // console.log('rawData', rawData)

    const data = await datas.map(d => ({
      ...d,
      content: d.content.length > 12 ? d.content.substring(0, 12) + '...' : d.content,
      // toUserName:,
      // toUserAccount:,
      // toUserAvatar: ,
    }))
    console.log('整理前', data)
    const msg = await data.filter(d => {
      return (Number(d.toId) === Number(toId) || Number(d.UserId) === Number(toId))
    })
    console.log('整理後', msg)
    return msg
  },


  subscribe: async (req, res) => {
    const currentUser = helpers.getUser(req)
    try {
      //中間資料大戰


      //追蹤者
      const users = await Followship.findAll({
        attributes: ['followingId', [sequelize.fn('COUNT', sequelize.col('followingId')), 'count']],
        include: [
          { model: User, as: 'FollowingLinks' }, //self-referential super-many-to-many
        ],
        group: ['followingId'],
        order: [[sequelize.col('count'), 'DESC']],
        limit: 10, raw: true, nest: true
      })

      //B. 右側欄位: 取得篩選過的使用者 & 依 followers 數量排列前 10 的使用者推薦名單(排除追蹤者為零者)
      const normalUsers = users.filter(d => d.FollowingLinks.role !== 'admin')
      const topUsers = normalUsers.map(user => ({
        id: user.FollowingLinks.id,
        name: user.FollowingLinks.name ? (user.FollowingLinks.name.length > 12 ? user.FollowingLinks.name.substring(0, 12) + '...' : user.FollowingLinks.name) : 'noName',
        account: user.FollowingLinks.account ? (user.FollowingLinks.account.length > 12 ? user.FollowingLinks.account.substring(0, 12) + '...' : user.FollowingLinks.account) : 'noAccount',
        avatar: user.FollowingLinks.avatar,
        followersCount: user.count,
        isFollowed: currentUser.Followings.map((d) => d.id).includes(user.FollowingLinks.id),
        isSelf: Boolean(user.FollowingLinks.id === currentUser.id),
      }))

      return res.render('notification', { topUsers, currentUser })
    } catch { error => { console.log(error) } }

  },

  subscription: async (req, res) => {
    try {
      const fansId = helpers.getUser(req).id
      const InfluencerId = Number(req.params.id)
      const targetUser = await User.findByPk(InfluencerId)
      const subscription = await Subscribe.findOne({
        where: {
          [Op.and]: [
            { fansId },
            { InfluencerId }
          ]
        }
      })

      if (fansId === InfluencerId) {

        req.flash('error_messages', '無法訂閱自己')
        return res.redirect('back')
      }
      if (!targetUser) {
        req.flash('error_messages', '無效對象')
        return res.redirect('back')
      }

      if (subscription) {
        req.flash('error_messages', '不得重複訂閱')
        return res.redirect('back')

      } else {
        await Subscribe.create({
          fansId,
          InfluencerId
        })
        req.flash('success_messages', '成功訂閱')
        return res.redirect('back')
      }
    }
    catch (err) {
      console.log(err)
    }
 },

//取消訂閱
 removeSubscribe:(req, res) => {
  const currentUserId = helpers.getUser(req).id
  return Subscribe.destroy({
    where:{
      fansId: currentUserId,
      InfluencerId: req.params.id
    }
  })
  .then(() => {
    return res.redirect('back')
  })
 }
 }
}

module.exports = messageController