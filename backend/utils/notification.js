const notifications = {};

function sendNotification(userId, message) {
  if (!notifications[userId]) notifications[userId] = [];
  notifications[userId].push({ message, date: new Date() });
}

function getNotifications(userId) {
  return notifications[userId] || [];
}

module.exports = { sendNotification, getNotifications };