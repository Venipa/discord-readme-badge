require("dotenv").config();
const Card = require("../src/Card");
const Discord = require("discord.js");
const imageToBase64 = require("image-to-base64");

const allowlistGames = require("../src/allowlistGames");

const truncate = (input) =>
  input.length > 32 ? `${input.substring(0, 32)}...` : input;

const encodeHTML = (input) => {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const processText = (input) => {
  return encodeHTML(truncate(input));
};

async function parsePresence(user) {
  const username = processText(user.username);
  let pfpImage = user.displayAvatarURL({
    format: "jpg",
    size: 256
  });
  pfpImage = await imageToBase64(pfpImage);
  pfpImage = "data:image/png;base64," + pfpImage;
  const statuses = user.presence.clientStatus;
  if (!statuses) {
    return {
      username,
      pfpImage,
      status: "offline",
      gameType: "Offline",
      game: "",
      details: "",
      detailsImage: false,
      state: "",
    };
  }
  const status = statuses.desktop || statuses.mobile || statuses.web;

  const playingRichGame = user.presence.activities
    .reverse()
    .find(
      (e) =>
        allowlistGames.includes(e.name.toLowerCase()) && (e.details || e.state)
    );
  const playingGame = user.presence.activities
    .reverse()
    .find(
      (e) =>
        allowlistGames.includes(e.name.toLowerCase()) && !e.details && !e.state
    );
  const spotifyGame = user.presence.activities.find(
    (e) => e.type == "LISTENING" && e.name == "Spotify"
  );

  const gameObject = playingRichGame || playingGame || spotifyGame;

  if (!gameObject) {
    return {
      username,
      pfpImage,
      status,
      gameType: "",
      game: "",
      details: "",
      detailsImage: false,
      state: "",
    };
  }

  // console.log(gameObject);

  const game = processText(gameObject.name);
  let gameType = "Playing";

  if (game == "Spotify") gameType = "Listening to";
  if (game == "Youtube Music") gameType = "Listening to";

  if (!gameObject.details && !gameObject.state) {
    return {
      username,
      pfpImage,
      status,
      gameType,
      game,
      details: "",
      detailsImage: false,
      state: "",
    };
  }

  const details = gameObject.details ? processText(gameObject.details) : "";

  let detailsImage = false;
  if (gameObject.assets && gameObject.assets.largeImage) {
    if (/^http/.test(gameObject.assets.largeImage)) detailsImage = imageToBase64(gameObject.assets.largeImage)
    else detailsImage = `https://cdn.discordapp.com/app-assets/${gameObject.applicationID}/${gameObject.assets.largeImage}.png`;

    if (game == "Spotify")
      detailsImage = `https://i.scdn.co/image/${gameObject.assets.largeImage.replace(
        "spotify:",
        ""
      )}`;

    detailsImage = await imageToBase64(detailsImage);
    detailsImage = "data:image/png;base64," + detailsImage;
  }

  const state = gameObject.state ? processText(gameObject.state) : "";

  return {
    username,
    pfpImage,
    status,
    game,
    gameType,
    details,
    detailsImage,
    state,
  };
}
// const userWhitelist = (process.env.GUILD_USER_WHITELIST || "").split(",");
const userGuildLookup = process.env.GUILD_ID;
export default function (req, res) {

  const { id } = req.query;
  if (!id) {
    return res.status(404).json({
      message: "No id defined"
    });
  }

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=30");
  const client = new Discord.Client();

  return client.login(process.env.DISCORD_TOKEN).then(async () => {
    const member = await client.guilds.fetch(userGuildLookup).then((g) => g.members.fetch(id));
    client.destroy();

    // console.log(member);

    let card;
    if (!member || member instanceof Discord.DiscordAPIError) {
      card = new Card({
        username: "Error",
        pfpImage:
          "https://canary.discord.com/assets/1cbd08c76f8af6dddce02c5138971129.png",
        status: "dnd",
        game: "Venipa/discord-readme-badge",
        gameType: "Check",
        details: processText(member.toString()),
        detailsImage: false,
        state: "Are you in the server? Correct ID?",
      });
    } else {
      const cardContent = await parsePresence(member.user);
      card = new Card(cardContent);
    }

    return res.send(card.render());
  });
};
