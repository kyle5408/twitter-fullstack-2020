const helpers = require('../_helpers')
const bcrypt = require('bcryptjs')
const db = require('../models')
const User = db.User
const { Op } = require("sequelize")
const sequelize = require('sequelize')
const userService = require('../services/userService')
const Tweet = db.Tweet
const Reply = db.Reply
const Like = db.Like
const Followship = db.Followship


const userController = {
  signUpPage: (req, res) => {
    return res.render('signUp')
  },

  signUp: (req, res) => {
    const { account, name, email, password, checkPassword } = req.body
    if (account.length < 5 || !name || name.length > 50 || !email || checkPassword !== password) {
      req.flash('error_messages', '表單內容不符合條件！')
      return res.redirect('/signup')
    }

    User.findAll({
      raw: true, nest: true,
      where: { [Op.or]: [{ email }, { account }] }
    })
      .then(users => {
        if (users.some(item => item.account === account)) {
          req.flash('error_messages', '註冊失敗，account 已重覆註冊！')
          return res.redirect('/signup')
        }
        if (users.some(item => item.email === email)) {
          req.flash('error_messages', '註冊失敗，email 已重覆註冊！')
          return res.redirect('/signup')
        }
        User.create({
          name,
          account,
          email,
          password: bcrypt.hashSync(password, bcrypt.genSaltSync(10), null)
        }).then(user => {
          req.flash('success_messages', 'Your account had been successfully registered!')
          return res.redirect('/signin')
        })
      })
  },

  getUserSetting: (req, res) => {
    if (req.params.id !== String(helpers.getUser(req).id)) {
      req.flash('error_messages', '無法編輯其他使用者的資料')
      return res.redirect(`/users/${helpers.getUser(req).id}/setting`)
    }
    User.findByPk(req.params.id)
      .then(user => {
        return res.render('setting', { currentUser: user.toJSON() })
      })
      .catch(err => console.log(err))
  },

  putUserEdit: (req, res) => {
    userService.putUserEdit(req, res, (data) => {
      if (data['status'] === 'error') {
        req.flash('error_messages', data['message'])
        return res.redirect(`/users/${helpers.getUser(req).id}/edit`)
      } else {
        req.flash('success_messages', data['message'])
        return res.redirect('back')
      }
    })
  },

  getUserTweets: (req, res) => {
    userService.getUserTweets(req, res, (data) => {
      return res.render('tweets', data)
    })
  },

  getUserReplied: (req, res) => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
    const currentUser = helpers.getUser(req)
    return Promise.all([
      Reply.findAll({
        where: { UserId: req.params.id },
        include: [
          { model: Tweet, include: [User] }
        ],
        order: [['createdAt', 'DESC']],
        raw: true, nest: true
      }),
      User.findOne({
        where: { id: req.params.id },
        include: [
          { model: Tweet },
          { model: User, as: 'Followers' },
          { model: User, as: 'Followings' }
        ]
      }),
      Followship.findAll({
        attributes: ['followingId', [sequelize.fn('COUNT', sequelize.col('followingId')), 'count']],
        include: [
          { model: User, as: 'FollowingLinks' } //self-referential super-many-to-many
        ],
        group: ['followingId'],
        order: [[sequelize.col('count'), 'DESC']],
        limit: 10, raw: true, nest: true
      }),
    ]).then(([replies, user, users]) => {
      const data = replies.map(reply => ({
        comment: reply.comment,
        tweetId: reply.TweetId,
        repliedAt: reply.createdAt,
        repliedByAccount: reply.Tweet.User.account,
        repliedById: reply.Tweet.User.id
      }))
      //A. 取得某使用者的個人資料 & followship 數量 & 登入中使用者是否有追蹤
      const viewUser = Object.assign({}, {
        id: user.id,
        name: user.name,
        account: user.account,
        introduction: user.introduction,
        cover: user.cover,
        avatar: user.avatar,
        tweetsCount: user.Tweets.length,
        followingsCount: user.Followings.length,
        followersCount: user.Followers.length,
        isFollowed: user.Followers.map((d) => d.id).includes(currentUser.id),
        isSelf: Boolean(user.id === currentUser.id)
      })
      //B. 右側欄位: 取得篩選過的使用者 & 依 followers 數量排列前 10 的使用者推薦名單(排除追蹤者為零者)
      const normalUsers = users.filter(d => d.FollowingLinks.role === 'normal')
      const topUsers = normalUsers.map(user => ({
        id: user.FollowingLinks.id,
        name: user.FollowingLinks.name ? (user.FollowingLinks.name.length > 12 ? user.FollowingLinks.name.substring(0, 12) + '...' : user.FollowingLinks.name) : 'noName',
        account: user.FollowingLinks.account ? (user.FollowingLinks.account.length > 12 ? user.FollowingLinks.account.substring(0, 12) + '...' : user.FollowingLinks.account) : 'noAccount',
        avatar: user.FollowingLinks.avatar,
        followersCount: user.count,
        isFollowed: currentUser.Followings.map((d) => d.id).includes(user.FollowingLinks.id),
        isSelf: Boolean(user.FollowingLinks.id === currentUser.id),
      }))
      return res.render('replied', { data, viewUser, currentUser, topUsers, BASE_URL })
    })
  },

  getUserLikes: (req, res) => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
    const currentUser = helpers.getUser(req)
    return Promise.all([
      Like.findAll({
        where: { UserId: req.params.id },
        include: [
          { model: Tweet, include: [Reply, Like, User] }
        ],
        order: [['createdAt', 'DESC']]
      }),
      User.findOne({
        where: { id: req.params.id },
        include: [
          { model: Tweet },
          { model: User, as: 'Followers' },
          { model: User, as: 'Followings' }
        ]
      }),
      Followship.findAll({
        attributes: ['followingId', [sequelize.fn('COUNT', sequelize.col('followingId')), 'count']],
        include: [
          { model: User, as: 'FollowingLinks' } //self-referential super-many-to-many
        ],
        group: ['followingId'],
        order: [[sequelize.col('count'), 'DESC']],
        limit: 10, raw: true, nest: true
      }),
    ]).then(([likes, user, users]) => {
      //整理某使用者所有讚過的推文 & 每則推文的留言數和讚數 & 登入中使用者是否有按讚
      const data = likes.map(like => ({
        id: like.Tweet.User.id,
        name: like.Tweet.User.name,
        account: like.Tweet.User.account,
        avatar: like.Tweet.User.avatar,
        likedAt: like.createdAt,
        tweetId: like.TweetId,
        tweetDescription: like.Tweet.description,
        tweetReplyCount: like.Tweet.Replies.length,
        tweetLikeCount: like.Tweet.Likes.length,
        isLiked: like.Tweet.Likes.map(d => d.UserId).includes(currentUser.id)
      }))
      //A. 取得某使用者的個人資料 & followship 數量 & 登入中使用者是否有追蹤
      const viewUser = Object.assign({}, {
        id: user.id,
        name: user.name,
        account: user.account,
        introduction: user.introduction,
        cover: user.cover,
        avatar: user.avatar,
        tweetsCount: user.Tweets.length,
        followingsCount: user.Followings.length,
        followersCount: user.Followers.length,
        isFollowed: user.Followers.map((d) => d.id).includes(currentUser.id),
        isSelf: Boolean(user.id === currentUser.id)
      })
      //B. 右側欄位: 取得篩選過的使用者 & 依 followers 數量排列前 10 的使用者推薦名單(排除追蹤者為零者)
      const normalUsers = users.filter(d => d.FollowingLinks.role === 'normal')//排除admin
      const topUsers = normalUsers.map(user => ({
        id: user.FollowingLinks.id,
        name: user.FollowingLinks.name ? (user.FollowingLinks.name.length > 12 ? user.FollowingLinks.name.substring(0, 12) + '...' : user.FollowingLinks.name) : 'noName',
        account: user.FollowingLinks.account ? (user.FollowingLinks.account.length > 12 ? user.FollowingLinks.account.substring(0, 12) + '...' : user.FollowingLinks.account) : 'noAccount',
        avatar: user.FollowingLinks.avatar,
        followersCount: user.count,
        isFollowed: currentUser.Followings.map((d) => d.id).includes(user.FollowingLinks.id),
        isSelf: Boolean(user.FollowingLinks.id === currentUser.id),
      }))
      return res.render('likes', { data, viewUser, currentUser, topUsers, BASE_URL })
    })
      .catch(err => console.log(err))
  },

  putUserSetting: (req, res) => {
    const { account, name, email, password, checkPassword } = req.body
    if (account.length < 5 || !name || name.length > 50 || !email || checkPassword !== password) {
      req.flash('error_messages', '表單內容不符合條件！')
      return res.redirect(`/users/${helpers.getUser(req).id}/setting`)
    }
    User.findAll({
      raw: true, nest: true,
      where: {
        [Op.or]: [{ email }, { account }],
        id: { [Op.ne]: helpers.getUser(req).id }
      }
    })
      .then(users => {
        if (users.some(item => item.account === account)) {
          req.flash('error_messages', 'account 已被他人使用！')
          return res.redirect(`/users/${helpers.getUser(req).id}/setting`)
        }
        if (users.some(item => item.email === email)) {
          req.flash('error_messages', 'email 已被他人使用！')
          return res.redirect(`/users/${helpers.getUser(req).id}/setting`)
        }
        return User.findByPk(req.params.id)
          .then((user) => {
            user.update({
              account,
              name,
              email,
              password: password ? bcrypt.hashSync(password, bcrypt.genSaltSync(10), null) : user.password
            })
              .then(() => {
                req.flash('success_messages', '使用者設定已成功被更新!')
                res.redirect('back')
              })
              .catch(err => console.error(err))
          })
      })
  },


  signInPage: (req, res) => {
    return res.render('signIn')
  },

  signIn: (req, res) => {
    req.flash('success_messages', '成功登入！')
    res.redirect('/tweets')
  },

  logout: (req, res) => {
    req.flash('success_messages', '登出成功！')
    req.logout()
    res.redirect('/signin')
  },

  getUserFollowings: (req, res) => {
    const currentUser = helpers.getUser(req)
    return Promise.all([
      User.findOne({
        where: { id: req.params.id },
        include: [
          { model: Tweet },
          { model: User, as: 'Followers' },
          { model: User, as: 'Followings' }
        ]
      }),
      Followship.findAll({
        attributes: ['followingId', [sequelize.fn('COUNT', sequelize.col('followingId')), 'count']],
        include: [
          { model: User, as: 'FollowingLinks' } //self-referential super-many-to-many
        ],
        group: ['followingId'],
        order: [[sequelize.col('count'), 'DESC']],
        limit: 10, raw: true, nest: true
      }),
    ]).then(([user, users]) => {
      //整理某使用者的所有推文 & 每則推文的留言數和讚數 & 登入中使用者是否有按讚
      const usersFollowing = user.Followings.map(d => ({
        ...d.dataValues,
        followTime:  d.Followship.createdAt,
        isFollowed: currentUser.Followings.map((d) => d.id).includes(d.dataValues.id)
      }))

      const usersFollowings = usersFollowing.sort((a, b) => b.followTime - a.followTime)

      let noFollowing = usersFollowings.length === 0 ? true : false

      //A. 取得某使用者的個人資料 & followship 數量 & 登入中使用者是否有追蹤
      const viewUser = Object.assign({}, {
        id: user.id,
        name: user.name,
        tweetsCount: user.Tweets.length,
      })
      //B. 右側欄位: 取得篩選過的使用者 & 依 followers 數量排列前 10 的使用者推薦名單(排除追蹤者為零者)
      const normalUsers = users.filter(d => d.FollowingLinks.role === 'normal')//排除admin
      const topUsers = normalUsers.map(user => ({
        id: user.FollowingLinks.id,
        name: user.FollowingLinks.name ? (user.FollowingLinks.name.length > 12 ? user.FollowingLinks.name.substring(0, 12) + '...' : user.FollowingLinks.name) : 'noName',
        account: user.FollowingLinks.account ? (user.FollowingLinks.account.length > 12 ? user.FollowingLinks.account.substring(0, 12) + '...' : user.FollowingLinks.account) : 'noAccount',
        avatar: user.FollowingLinks.avatar,
        followersCount: user.count,
        isFollowed: currentUser.Followings.map((d) => d.id).includes(user.FollowingLinks.id),
        isSelf: Boolean(user.FollowingLinks.id === currentUser.id),
      }))
      return res.render('followship', {
        usersFollowings: usersFollowings.length !== 0 ? usersFollowings : true,
        user: helpers.getUser(req),
        topUsers,
        viewUser,
        noFollowing
      })
    })
  },

  getUserFollowers: (req, res) => {
    const currentUser = helpers.getUser(req)
    return Promise.all([
      User.findOne({
        where: { id: req.params.id },
        include: [
          { model: Tweet },
          { model: User, as: 'Followers' },
          { model: User, as: 'Followings' }
        ]
      }),
      Followship.findAll({
        attributes: ['followingId', [sequelize.fn('COUNT', sequelize.col('followingId')), 'count']],
        include: [
          { model: User, as: 'FollowingLinks' } //self-referential super-many-to-many
        ],
        group: ['followingId'],
        order: [[sequelize.col('count'), 'DESC']],
        limit: 10, raw: true, nest: true
      }),
      
    ]).then(([user, users]) => {
      //整理某使用者的所有推文 & 每則推文的留言數和讚數 & 登入中使用者是否有按讚
      const usersFollower = user.Followers.map(d => ({
        ...d.dataValues,
        followTime: d.Followship.createdAt,
        isFollowed: currentUser.Followings.map((d) => d.id).includes(d.dataValues.id),
        ...d.Followship,
      }))

      const usersFollowers = usersFollower.sort((a, b) => b.followTime - a.followTime)

      let noFollower = usersFollowers.length === 0 ? true : false

      //A. 取得某使用者的個人資料 & followship 數量 & 登入中使用者是否有追蹤
      const viewUser = Object.assign({}, {
        id: user.id,
        name: user.name,
        tweetsCount: user.Tweets.length,
      })
      //B. 右側欄位: 取得篩選過的使用者 & 依 followers 數量排列前 10 的使用者推薦名單(排除追蹤者為零者)
      const normalUsers = users.filter(d => d.FollowingLinks.role === 'normal')
      const topUsers = normalUsers.map(user => ({
        id: user.FollowingLinks.id,
        name: user.FollowingLinks.name ? (user.FollowingLinks.name.length > 12 ? user.FollowingLinks.name.substring(0, 12) + '...' : user.FollowingLinks.name) : 'noName',
        account: user.FollowingLinks.account ? (user.FollowingLinks.account.length > 12 ? user.FollowingLinks.account.substring(0, 12) + '...' : user.FollowingLinks.account) : 'noAccount',
        avatar: user.FollowingLinks.avatar,
        followersCount: user.count,
        isFollowed: currentUser.Followings.map((d) => d.id).includes(user.FollowingLinks.id),
        isSelf: Boolean(user.FollowingLinks.id === currentUser.id),
      }))
      return res.render('followship', {
        usersFollowers: usersFollowers.length !== 0 ? usersFollowers : true,
        user: helpers.getUser(req),
        topUsers,
        viewUser,
        noFollower
      })
    })
  },

  addFollowing: async (req, res) => {
    userService.addFollowing(req, res, data => {
      if (data['status'] === 'error') {
        req.flash('error_messages', data['message'])
        return res.status(200).json({
          data
        })
      }
      req.flash('success_messages', data['message'])
      res.redirect('back')
    })
  },

  removeFollowing: (req, res) => {
    const currentUserId = helpers.getUser(req).id
    return Followship.destroy({
      where: {
        followerId: currentUserId,
        followingId: req.params.id
      }
    }).then(() => {
      return res.redirect('back')
    })
  }
}



module.exports = userController