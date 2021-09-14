const helpers = require('../_helpers')
const db = require('../models')
const User = db.User
const Tweet = db.Tweet
const Reply = db.Reply

const tweetController = {
//貼文相關
  //顯示所有貼文
  getTweets: (req, res) => {
    return Tweet.findAll({ 
      raw: true, 
      nest: true, 
      include: [User]
    }).then(tweet => {
        return res.render('index', { 
          tweet: tweet,
          })
      }) //目前可以看到全部
  },

  //新增一則貼文(要改api)
  createTweets: (req, res) => {
    return res.render('create')
  },

  postTweets: (req, res) => {
    if (!req.body.tweet) {
      req.flash('error_messages', "請輸入貼文內容")
      return res.redirect('/index')
    }
    return Tweet.create({  
      UserId: req.user.id,
      description: req.body.tweet
    })
      .then((tweet) => {
        req.flash('success_messages', 'tweet was successfully created')
        res.redirect('/index')
      })
  },
  //顯示特定貼文(要改api)
  getTweet: (req, res) => {
   return Tweet.findByPk(req.params.id, {
    include: [Reply]
    })
    .then(tweet => {
      return res.render('tweet', {
        tweet: tweet.toJSON()
      })
    })
  },

//回文相關
  //回覆特定貼文
  createReply: (req, res) => {
    return Reply.create({
      comment: req.body.reply,
      TweetId: req.body.TweetId,
      UserId: req.user.id
    })
    .then((reply)=>{
      res.redirect(`/index/${req.body.TweetId}`)
    })
  },
  //顯示特定貼文回覆
  // getTweetReplies: (req, res) => {

  // },

//Like & Unlike
  //喜歡特定貼文
  // addLike: (req, res) => {

  // },
  //取消喜歡特定貼文
  // removeLike: (req, res) => {

  // }
}

module.exports = tweetController