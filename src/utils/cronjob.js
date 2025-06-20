const cron = require("node-cron");
const { subDays, startOfDay, endOfDay, subHours } = require("date-fns");
const sendEmail = require("./sendEmail");
const ConnectionRequestModel = require("../models/connectionRequest");
const Chat = require("../models/chat");
const User = require("../models/User");

console.log("📅 Cron jobs initialized for MergeMates notifications");

// Helper function to create beautiful email templates
const createEmailTemplate = (title, content, ctaText, ctaLink) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; margin-top: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
        .logo { color: white; font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .header-text { color: rgba(255,255,255,0.9); font-size: 16px; }
        .content { padding: 40px 30px; }
        .title { font-size: 24px; color: #2d3748; margin-bottom: 20px; font-weight: 600; }
        .message { color: #4a5568; line-height: 1.6; margin-bottom: 30px; font-size: 16px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: transform 0.2s; }
        .cta-button:hover { transform: translateY(-2px); }
        .footer { background: #f7fafc; padding: 20px 30px; text-align: center; color: #718096; font-size: 14px; border-top: 1px solid #e2e8f0; }
        .stats { background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .stat-item { display: inline-block; margin: 0 20px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
        .stat-label { font-size: 12px; color: #718096; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">💕 MergeMates</div>
          <div class="header-text">Where Developers Find Love</div>
        </div>
        <div class="content">
          <h1 class="title">${title}</h1>
          <div class="message">${content}</div>
          <div style="text-align: center;">
            <a href="${ctaLink}" class="cta-button">${ctaText}</a>
          </div>
        </div>
        <div class="footer">
                  <p>You're receiving this email because you're part of the MergeMates community.</p>
        <p>MergeMates - Connecting Developers Worldwide | <a href="#">Unsubscribe</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Daily Friend Requests Reminder - 8 AM
cron.schedule("0 8 * * *", async () => {
  console.log("🔔 Running daily friend requests reminder job...");
  
  try {
    const yesterday = subDays(new Date(), 1);
    const yesterdayStart = startOfDay(yesterday);
    const yesterdayEnd = endOfDay(yesterday);

    const pendingRequests = await ConnectionRequestModel.find({
      status: "interested",
      createdAt: {
        $gte: yesterdayStart,
        $lt: yesterdayEnd,
      },
    }).populate("fromUserId toUserId");

    // Group requests by recipient
    const requestsByUser = {};
    pendingRequests.forEach(req => {
      const userId = req.toUserId._id.toString();
      if (!requestsByUser[userId]) {
        requestsByUser[userId] = {
          user: req.toUserId,
          requests: []
        };
      }
      requestsByUser[userId].requests.push(req);
    });

    console.log(`📧 Sending friend request reminders to ${Object.keys(requestsByUser).length} users`);

    for (const [userId, data] of Object.entries(requestsByUser)) {
      const { user, requests } = data;
      const requestCount = requests.length;
      
      const emailContent = `
        <p>Hey ${user.firstName}! 👋</p>
        <p>You have <strong>${requestCount} new connection request${requestCount > 1 ? 's' : ''}</strong> waiting for your response on MergeMates!</p>
        <div class="stats">
          <div class="stat-item">
            <div class="stat-number">${requestCount}</div>
            <div class="stat-label">New Requests</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${requests.filter(r => r.fromUserId.isPremium).length}</div>
            <div class="stat-label">Premium Users</div>
          </div>
        </div>
        <p>Don't keep fellow developers waiting! Check out who's interested in connecting with you and start building meaningful relationships in the tech community.</p>
      `;

      try {
        await sendEmail.run(
          user.emailId,
          `${requestCount} New Connection Request${requestCount > 1 ? 's' : ''} on MergeMates! 💝`,
          createEmailTemplate(
            `You Have ${requestCount} New Connection Request${requestCount > 1 ? 's' : ''}!`,
            emailContent,
            "View Requests",
            "https://mergemates.com/requests"
          )
        );
        console.log(`✅ Sent friend request reminder to ${user.emailId}`);
      } catch (err) {
        console.error(`❌ Failed to send email to ${user.emailId}:`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ Friend requests cron job failed:", err);
  }
});

// Unread Messages Reminder - 6 PM
cron.schedule("0 18 * * *", async () => {
  console.log("🔔 Running daily unread messages reminder job...");
  
  try {
    const yesterday = subDays(new Date(), 1);
    const yesterdayStart = startOfDay(yesterday);
    const now = new Date();

    // Find chats with recent messages where user hasn't responded
    const chatsWithUnreadMessages = await Chat.find({
      "messages.createdAt": {
        $gte: yesterdayStart,
        $lt: now,
      }
    }).populate("participants");

    const notificationsByUser = {};

    for (const chat of chatsWithUnreadMessages) {
      const recentMessages = chat.messages.filter(msg => 
        msg.createdAt >= yesterdayStart && msg.createdAt < now
      );

      // Group messages by sender to find who hasn't replied
      for (const participant of chat.participants) {
        const otherParticipant = chat.participants.find(p => 
          p._id.toString() !== participant._id.toString()
        );

        const messagesFromOther = recentMessages.filter(msg => 
          msg.senderId.toString() === otherParticipant._id.toString()
        );

        const messagesFromUser = recentMessages.filter(msg => 
          msg.senderId.toString() === participant._id.toString()
        );

        // If other user sent messages but user didn't reply
        if (messagesFromOther.length > 0 && messagesFromUser.length === 0) {
          if (!notificationsByUser[participant._id.toString()]) {
            notificationsByUser[participant._id.toString()] = {
              user: participant,
              unreadChats: []
            };
          }
          
          notificationsByUser[participant._id.toString()].unreadChats.push({
            otherUser: otherParticipant,
            messageCount: messagesFromOther.length,
            lastMessage: messagesFromOther[messagesFromOther.length - 1]
          });
        }
      }
    }

    console.log(`📧 Sending unread message reminders to ${Object.keys(notificationsByUser).length} users`);

    for (const [userId, data] of Object.entries(notificationsByUser)) {
      const { user, unreadChats } = data;
      const totalUnreadCount = unreadChats.reduce((sum, chat) => sum + chat.messageCount, 0);
      
      const chatList = unreadChats.map(chat => 
        `<li><strong>${chat.otherUser.firstName}</strong> sent ${chat.messageCount} message${chat.messageCount > 1 ? 's' : ''}</li>`
      ).join('');

      const emailContent = `
        <p>Hey ${user.firstName}! 💬</p>
        <p>You have <strong>${totalUnreadCount} unread message${totalUnreadCount > 1 ? 's' : ''}</strong> from ${unreadChats.length} conversation${unreadChats.length > 1 ? 's' : ''} on MergeMates!</p>
        <div class="stats">
          <div class="stat-item">
            <div class="stat-number">${totalUnreadCount}</div>
            <div class="stat-label">Unread Messages</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${unreadChats.length}</div>
            <div class="stat-label">Active Chats</div>
          </div>
        </div>
        <p><strong>Recent activity:</strong></p>
        <ul>${chatList}</ul>
        <p>Don't leave your matches hanging! Jump back into the conversation and keep those connections growing. 🚀</p>
      `;

      try {
        await sendEmail.run(
          user.emailId,
          `${totalUnreadCount} Unread Message${totalUnreadCount > 1 ? 's' : ''} on MergeMates! 💬`,
          createEmailTemplate(
            `You Have ${totalUnreadCount} Unread Message${totalUnreadCount > 1 ? 's' : ''}!`,
            emailContent,
            "Reply Now",
            "https://mergemates.com/chat"
          )
        );
        console.log(`✅ Sent unread messages reminder to ${user.emailId}`);
      } catch (err) {
        console.error(`❌ Failed to send email to ${user.emailId}:`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ Unread messages cron job failed:", err);
  }
});

// Weekly Activity Summary - Sunday 9 AM
cron.schedule("0 9 * * 0", async () => {
  console.log("🔔 Running weekly activity summary job...");
  
  try {
    const oneWeekAgo = subDays(new Date(), 7);
    const users = await User.find({ isVerified: true });

    console.log(`📧 Sending weekly summaries to ${users.length} users`);

    for (const user of users) {
      // Get user's weekly stats
      const weeklyRequests = await ConnectionRequestModel.countDocuments({
        toUserId: user._id,
        createdAt: { $gte: oneWeekAgo }
      });

      const weeklySentRequests = await ConnectionRequestModel.countDocuments({
        fromUserId: user._id,
        createdAt: { $gte: oneWeekAgo }
      });

      const weeklyMatches = await ConnectionRequestModel.countDocuments({
        $or: [{ fromUserId: user._id }, { toUserId: user._id }],
        status: "accepted",
        createdAt: { $gte: oneWeekAgo }
      });

      // Only send if there's some activity
      if (weeklyRequests > 0 || weeklySentRequests > 0 || weeklyMatches > 0) {
        const emailContent = `
          <p>Hey ${user.firstName}! 📊</p>
          <p>Here's your weekly MergeMates activity summary:</p>
          <div class="stats">
            <div class="stat-item">
              <div class="stat-number">${weeklyRequests}</div>
              <div class="stat-label">Requests Received</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${weeklyMatches}</div>
              <div class="stat-label">New Matches</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${weeklySentRequests}</div>
              <div class="stat-label">Requests Sent</div>
            </div>
          </div>
          <p>Keep up the great work connecting with fellow developers! 🎉</p>
          <p>Ready to find more matches? Jump back in and continue your journey to finding your perfect coding partner!</p>
        `;

        try {
          await sendEmail.run(
            user.emailId,
            `Your Weekly MergeMates Summary - ${weeklyMatches} New Matches! 📊`,
            createEmailTemplate(
                              "Your Weekly MergeMates Activity Summary",
                              emailContent,
                "Continue Matching",
                "https://mergemates.com/feed"
            )
          );
          console.log(`✅ Sent weekly summary to ${user.emailId}`);
        } catch (err) {
          console.error(`❌ Failed to send weekly summary to ${user.emailId}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error("❌ Weekly summary cron job failed:", err);
  }
});

// Inactive Users Re-engagement - Every 3 days at 11 AM
cron.schedule("0 11 */3 * *", async () => {
  console.log("🔔 Running inactive users re-engagement job...");
  
  try {
    const threeDaysAgo = subDays(new Date(), 3);
    const oneWeekAgo = subDays(new Date(), 7);

    // Find users who were active a week ago but not in the last 3 days
    const inactiveUsers = await User.find({
      isVerified: true,
      lastActive: {
        $gte: oneWeekAgo,
        $lt: threeDaysAgo
      }
    });

    console.log(`📧 Sending re-engagement emails to ${inactiveUsers.length} inactive users`);

    for (const user of inactiveUsers) {
      const pendingRequests = await ConnectionRequestModel.countDocuments({
        toUserId: user._id,
        status: "interested"
      });

      const emailContent = `
        <p>Hey ${user.firstName}! 👋</p>
        <p>We miss you on MergeMates! The developer community has been buzzing with activity while you've been away.</p>
        ${pendingRequests > 0 ? `<p>🔥 <strong>You have ${pendingRequests} pending connection request${pendingRequests > 1 ? 's' : ''}</strong> waiting for you!</p>` : ''}
        <div class="stats">
          <div class="stat-item">
            <div class="stat-number">${pendingRequests}</div>
            <div class="stat-label">Pending Requests</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">500+</div>
            <div class="stat-label">New Developers</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">50+</div>
            <div class="stat-label">Success Stories</div>
          </div>
        </div>
        <p>Don't let these opportunities slip away! Come back and continue building meaningful connections with fellow developers. 🚀</p>
      `;

      try {
        await sendEmail.run(
          user.emailId,
          `We Miss You on MergeMates! ${pendingRequests > 0 ? `${pendingRequests} Request${pendingRequests > 1 ? 's' : ''} Waiting` : 'Come Back!'} 💕`,
          createEmailTemplate(
                          "We Miss You on MergeMates!",
                          emailContent,
              "Welcome Back",
              "https://mergemates.com/feed"
          )
        );
        console.log(`✅ Sent re-engagement email to ${user.emailId}`);
      } catch (err) {
        console.error(`❌ Failed to send re-engagement email to ${user.emailId}:`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ Re-engagement cron job failed:", err);
  }
});

console.log("✅ All cron jobs scheduled successfully!");
console.log("📅 Schedule:");
console.log("   • Daily friend requests reminder: 8:00 AM");
console.log("   • Daily unread messages reminder: 6:00 PM");  
console.log("   • Weekly activity summary: Sunday 9:00 AM");
console.log("   • Re-engagement emails: Every 3 days 11:00 AM");

module.exports = {};
