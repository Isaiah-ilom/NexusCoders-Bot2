module.exports = {
    botName: "NexusCoders Bot",
    prefix: "!",
    ownerNumber: "2347075663318@s.whatsapp.net",
    supportGroup: "group-id@g.us",
    mongoUri: process.env.MONGO_URI || "mongodb+srv://arisonbeckham:arisonbeckham@nexuscoders.yxxbj.mongodb.net/?retryWrites=true&w=majority&appName=NexusCoders",
    commandCooldown: 3,
    autoRead: true,
    autoTyping: true,
    autoRecording: false,
    messages: {
        permissionError: "⚠️ You don't have permission to use this command!",
        cooldownError: "⏳ Please wait before using this command again.",
        error: "❌ An error occurred while executing this command.",
        success: "✅ Command executed successfully!"
    },
    features: {
        antiSpam: true,
        antiLink: true,
        autoMute: false,
        welcomeMessage: true
    }
};

