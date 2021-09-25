'use strict';
module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    UserId: DataTypes.INTEGER,
    content: DataTypes.STRING,
    roomName: DataTypes.STRING,
    toId: DataTypes.INTEGER,
  }, {});
  Message.associate = function(models) {
    Message.belongsTo(models.User)
    // associations can be defined here
  };
  return Message;
};