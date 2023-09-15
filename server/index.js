const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const express = require("express");
const ethers = require("ethers");
const fetch = require("node-fetch");
const dayjs = require("dayjs");
const dotenv = require("dotenv");
const process = require("process");
const fs = require("fs");
// Initialize the express app
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  Timestamp,
  addDoc,
  updateDoc,
  writeBatch,
} = require("firebase/firestore");
const factoryAbi = require("./constants/factoryAbi");
const lpAbi = require("./constants/lpAbi");
const tokenAbi = require("./constants/tokenAbi");
const { auth, googleProvider, db } = require("./config");

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

const { formatEther } = ethers.utils;

const UNISWAP_FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"; // uniswap factory mainnet
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; //mainnet
const MIN_ETH_LIQUIDITY = 1.85; // required minimum liquidity in eth to trade
const MIN_ETH = 0.001;
// Create a Telegram bot instance
// 6464830667:AAH2wb1mrWetd9MmMPvcM_OOSbEWrL25f4M testing
// 6551341570:AAGCelyCW1GOWgO6QQrCkZ_f-fSb2e7yINk
// const BOT_TOKEN = "6453134222:AAEm4qRJXWzSFoteYbc0HlGSnC1ggmtRC6A"; //main @X-Caller-Bot
// const BOT_TOKEN = "6464830667:AAH2wb1mrWetd9MmMPvcM_OOSbEWrL25f4M"; // ggg wala bot
const BOT_TOKEN = "6451383517:AAF1rxflZnBVu_GkpprCGtpyes9HiW6GcXo"; //  wala bot
const bot = new TelegramBot(BOT_TOKEN, {
  polling: true,
});

const { DEXTOOL_API, SNIFFER_API } = process.env;
// Create a NeDB database for storing wallet addresses
// const db = new Datastore({ filename: "wallets.db", autoload: true });

// Store user states (for tracking user actions)
const userStates = new Map();
const walletsCollection = collection(db, "wallets"); // Reference to the "wallets" collection
const q = query(walletsCollection, where("status", "==", "true"));

getDocs(q)
  .then((querySnapshot) => {
    const addresses = [];
    const chatIds = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();

      const chatId = data.chatId;
      const walletAddress = data.walletAddress;

      addresses.push(walletAddress);
      chatIds.push(chatId);

      // You can also use chatId and walletAddress here as needed
      // For example, you can send messages or perform other operations
    });
    if (addresses.length > 0) {
      provider.on("pending", async (tx) => {
        processTransaction(tx, addresses, chatIds);
      });
    }

    // Now you have arrays containing chatIds and walletAddresses
    console.log("Chat IDs:", chatIds);
    console.log("Wallet Addresses:", addresses);

    // Optionally, you can process the data further or send messages here
  })
  .catch((error) => {
    console.error("Error fetching documents:", error);
  });

const amountRequired = 480310139;
const checkUserBalance = async (PRIVATE_KEY) => {
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(
    "0xa62894d5196bc44e4c3978400ad07e7b30352372",
    tokenAbi,
    provider
  );

  const balance = await contract.balanceOf(wallet.address);
  if (Number(ethers.utils.formatUnits(balance.toString(), 9)) < amountRequired)
    return false;

  return true;
};

const checkactivate = async (chatId) => {
  try {
    const walletsCollection = collection(db, "rug"); // Reference to the "rug" collection
    const q = query(
      walletsCollection,
      where("status", "==", "true"),
      where("chatId", "==", chatId)
    );

    const querySnapshot = await getDocs(q);

    // Check if there are any documents with the given chatId and status true
    if (!querySnapshot.empty) {
      return true; // Status is true
    } else {
      return false; // Status is not true
    }
  } catch (error) {
    console.error("Error checking status:", error);
    throw error; // Propagate the error if any error occurs during the check
  }
};
// Handle the /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const message = "Main Menu";
  const s = await checkactivate(chatId);
  console.log(s);
  if (s) {
    const options = {
      reply_markup: JSON.stringify(getKeyboards()),
    };

    // Set the user state to "awaiting_private_key"
    bot
      .sendMessage(chatId, message, options)
      .then((message) => {
        // Pin the message to the top of the chat
        bot.pinChatMessage(chatId, message.message_id, options, {
          disable_notification: true,
        });
      })
      .catch((error) => {
        console.error("Error sending/pinning message:", error);
      });
  } else {
    const options = {
      reply_markup: JSON.stringify(getKeyboard()),
    };

    // Set the user state to "awaiting_private_key"
    bot
      .sendMessage(chatId, message, options)
      .then((message) => {
        // Pin the message to the top of the chat
        bot.pinChatMessage(chatId, message.message_id, options, {
          disable_notification: true,
        });
      })
      .catch((error) => {
        console.error("Error sending/pinning message:", error);
      });
  }

  // bot.sendMessage(chatId, message, options);
});

// Handle button clicks
bot.on("callback_query", (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  switch (data) {
    case "button1":
      const additionalButtons = {
        inline_keyboard: [
          [{ text: "⏳ Add Wallet", callback_data: "buttonA" }],
          [{ text: "❌ Delete Wallet", callback_data: "buttonB" }],
          [{ text: "👨‍💻 Your Wallets", callback_data: "buttonC" }],
          [{ text: "⚙️ Settings", callback_data: "buttonD" }],
        ],
      };
      const options = {
        reply_markup: JSON.stringify(additionalButtons),
      };
      bot
        .sendMessage(chatId, "Please choose an option:", options)
        .then((message) => {
          // Pin the message to the top of the chat
          bot.pinChatMessage(chatId, message.message_id, options, {
            disable_notification: true,
          });
        })
        .catch((error) => {
          console.error("Error sending/pinning message:", error);
        });
      // bot.sendMessage(chatId, "Please choose an option:", options);
      break;
    case "buttonA":
      userStates.set(chatId, "awaiting_address");
      bot.sendMessage(chatId, "Please paste the wallet address:");
      break;
    case "buttonB":
      userStates.set(chatId, "delete_wallet");
      bot.sendMessage(chatId, "Please paste the Wallet address:");
      break;
    case "buttonC":
      getAddress(chatId);
      break;
    case "buttonD":
      const additionalButtonsD = {
        inline_keyboard: [
          [{ text: "🔴 Tracker Off", callback_data: "buttonOFF" }],
          [{ text: "🟢 Tracker ON", callback_data: "buttonON" }],
          [{ text: "🟢 Particular Tracker ON", callback_data: "buttonPON" }],
          [{ text: "🔴 Particular Tracker OFF", callback_data: "buttonPOFF" }],
        ],
      };
      const optionsD = {
        reply_markup: JSON.stringify(additionalButtonsD),
      };
      bot.sendMessage(chatId, "Please choose an option:", optionsD);
      break;

    case "button5":
      userStates.set(chatId, "info_token");
      bot.sendMessage(chatId, "Please paste the Token address:");
      break;
    case "button6":
      userStates.set(chatId, "rugPull");
      addRugPull(chatId);
      break;
    case "button7":
      updateRugPull(chatId);
      break;
    case "buttonOFF":
      updateAllWalletStatusToFalse(chatId, "false");
      userStates.delete(chatId);
      break;
    case "buttonON":
      updateAllWalletStatusToFalse(chatId, "true");
      userStates.delete(chatId);
      break;

    case "buttonPOFF":
      userStates.set(chatId, "trackOff");
      bot.sendMessage(chatId, "Please paste the wallet address:");
      break;

    case "buttonPON":
      userStates.set(chatId, "trackON");
      bot.sendMessage(chatId, "Please paste the wallet address:");

      break;

    default:
      // Handle other button actions if needed
      break;
  }
});

// Handle user messages
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  const userState = userStates.get(chatId);

  if (userState === "awaiting_address") {
    const walletAddress = messageText;
    handleAddress(chatId, walletAddress);
    userStates.delete(chatId);
  } else if (userState === "delete_wallet") {
    const walletAddress = messageText;
    deleteWallet(chatId, walletAddress);
    userStates.delete(chatId);
  } else if (userState === "info_token") {
    const walletAddress = messageText;
    tokenInfo(chatId, walletAddress);
    userStates.delete(chatId);
  } else if (userState == "trackOff") {
    const walletAddress = messageText;
    trackOff(chatId, walletAddress, "false");
    userState.delete(chatId);
  } else if (userState == "trackON") {
    const walletAddress = messageText;
    trackOff(chatId, walletAddress, "true");
    userState.delete(chatId);
  } else {
    userStates.delete(chatId);
  }
});

// Function to get the inline keyboard
function getKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "💼 Wallet Tracker", callback_data: "button1" }],
      [{ text: "🔍 Token Scanner", callback_data: "button5" }],
      [{ text: "🚨  Activate X-Caller", callback_data: "button6" }],
      // [{ text: "🚨 De-Activate X-Caller", callback_data: "button7" }],
    ],
  };
}
function getKeyboards() {
  return {
    inline_keyboard: [
      [{ text: "💼 Wallet Tracker", callback_data: "button1" }],
      [{ text: "🔍 Token Scanner", callback_data: "button5" }],
      // [{ text: "🚨 X-Caller Activate", callback_data: "button6" }],
      [{ text: "🚨 De-Activate X-Caller", callback_data: "button7" }],
    ],
  };
}
async function trackOff(chatId, walletAddress, status) {
  try {
    // Check if the wallet exists in Firestore
    const userQuery = query(
      collection(db, "wallets"),
      where("walletAddress", "==", walletAddress),
      where("chatId", "==", chatId)
    );
    const querySnapshot = await getDocs(userQuery);

    if (querySnapshot.size === 0) {
      // Wallet doesn't exist in Firestore, you can handle this case accordingly.
      bot.sendMessage(chatId, `Wallet ${walletAddress} not found.`);
    } else {
      // Wallet found, update the "status" field to "false"

      // Get the reference to the existing document
      const userDoc = querySnapshot.docs[0];
      console.log(userDoc.id);
      const userRef = doc(db, "wallets", userDoc.id);

      // Update the status field
      const newData = {
        status: status, // Set the status to "false"
      };

      await updateDoc(userRef, newData);

      bot.sendMessage(chatId, `Wallet ${walletAddress} status updated.`);
    }
  } catch (error) {
    console.error("An error occurred:", error);
    bot.sendMessage(chatId, "An error occurred.");
  }
}

async function updateAllWalletStatusToFalse(chatId, status) {
  try {
    const walletCollectionRef = query(
      collection(db, "wallets"),
      where("chatId", "==", chatId)
    );
    const querySnapshot = await getDocs(walletCollectionRef);

    if (querySnapshot.empty) {
      // No wallets found in Firestore
      bot.sendMessage(chatId, "No wallets found.");
    } else {
      // Create a batched write to update all documents
      const batch = writeBatch(db);

      querySnapshot.forEach((doc) => {
        const walletRef = doc.ref;

        // Update the status field to "false"
        const newData = {
          status: status,
        };

        // Queue the update operation in the batch
        batch.update(walletRef, newData);
      });

      // Commit the batch to update all documents
      await batch.commit();

      bot.sendMessage(chatId, "All wallet statuses updated ");
    }
  } catch (error) {
    console.error("An error occurred:", error);
    bot.sendMessage(chatId, "An error occurred.");
  }
}

// Function to handle adding a wallet address
async function handleAddress(chatId, walletAddress) {
  try {
    // Check if the wallet exists in Firestore
    console.log(chatId, walletAddress);
    const userQuery = query(
      collection(db, "wallets"),
      where("walletAddress", "==", walletAddress),
      where("chatId", "==", chatId)
    );
    const querySnapshot = await getDocs(userQuery);
    console.log(querySnapshot, querySnapshot.length);
    if (querySnapshot.size === 0) {
      // User email doesn't exist in Firestore, proceed to create and store user data

      // Store user data in Firestore
      const userData = {
        walletAddress: walletAddress,
        chatId: chatId,
        status: "true",
      };

      const userRef = collection(db, "wallets");

      // Set the user data in Firestore
      await addDoc(userRef, userData);

      bot.sendMessage(chatId, `Wallet ${walletAddress} added successfully.`);
    } else {
      bot.sendMessage(chatId, `Wallet ${walletAddress} is already added.`);
    }
  } catch (error) {
    console.error("An error occurred:", error);
    bot.sendMessage(chatId, "An error occurred.");
  }
}
async function updateRugPull(chatId) {
  try {
    const userRef = doc(db, "rug", chatId.toString());
    console.log(userRef);
    // Update the status field
    const newData = {
      status: "false", // Set the status to "false"
    };

    await updateDoc(userRef, newData);

    bot.sendMessage(chatId, `X-Caller Deactivated.`);
  } catch (error) {
    console.error("An error occurred:", error);
    bot.sendMessage(chatId, "An error occurred.");
  }
}

async function addRugPull(chatId) {
  try {
    // Check if the wallet exists in Firestore
    console.log(chatId);
    const userQuery = query(
      collection(db, "rug"),
      where("chatId", "==", chatId.toString())
    );
    const querySnapshot = await getDocs(userQuery);

    if (querySnapshot.size === 0) {
      // User email doesn't exist in Firestore, proceed to create and store user data

      // Store user data in Firestore
      const userData = {
        status: "true",
        chatId: chatId,
      };

      const userRef = doc(db, "rug", chatId.toString());

      // Set the user data in Firestore
      await setDoc(userRef, userData);

      bot.sendMessage(chatId, `X-Caller Activated, APE at your own risk.`);
    } else {
      bot.sendMessage(chatId, `X-Caller Already Activated`);
    }
  } catch (error) {
    console.error("An error occurred:", error);
    bot.sendMessage(chatId, "An error occurred.");
  }
}

// Function to get wallet addresses for a user
function getAddress(chatId) {
  const myCollection = collection(db, "wallets"); // Replace with your collection name
  const myQuery = query(myCollection, where("chatId", "==", chatId));

  // Now you can execute the query using `getDocs`
  getDocs(myQuery)
    .then((querySnapshot) => {
      if (querySnapshot.size === 0) {
        // No documents found
        bot.sendMessage(chatId, "No wallets added.");
      } else {
        // Loop through documents and create a wallet list
        const walletList = [];
        querySnapshot.forEach((doc) => {
          const walletAddress = doc.data().walletAddress;
          const status = doc.data().status;

          // Determine the emoji based on the status
          const emoji = status === "true" ? "🟢" : "🔴";

          // Append wallet address with emoji
          walletList.push(`${emoji} ${walletAddress}`);
        });

        // Send the wallet list as a message
        bot.sendMessage(chatId, `Your wallets:\n${walletList.join("\n")}`);
      }
    })
    .catch((error) => {
      // Handle any errors that occur during the query
      console.error("Error querying Firestore:", error);
      bot.sendMessage(chatId, "An error occurred.");
    });
}

// Function to delete a wallet
function deleteWallet(chatId, walletAddress) {
  const collectionName = "wallets"; // Replace with your collection name
  const myQuery = query(
    collection(db, collectionName),
    where("chatId", "==", chatId),
    where("walletAddress", "==", walletAddress)
  );

  // Execute the query and delete the matching document
  getDocs(myQuery)
    .then((querySnapshot) => {
      if (querySnapshot.size === 0) {
        // Document not found
        bot.sendMessage(
          chatId,
          `Wallet ${walletAddress} not found in the database.`
        );
      } else {
        // Assuming each wallet has a unique ID, delete the first matching document
        const doc = querySnapshot.docs[0];
        const docId = doc.id;

        // Delete the document
        deleteDoc(doc.ref)
          .then(() => {
            bot.sendMessage(
              chatId,
              `Wallet ${walletAddress} removed successfully.`
            );
          })
          .catch((error) => {
            console.error("Error removing document:", error);
            bot.sendMessage(
              chatId,
              "An error occurred while removing the wallet."
            );
          });
      }
    })
    .catch((error) => {
      console.error("Error querying Firestore:", error);
      bot.sendMessage(chatId, "An error occurred.");
    });
}

const MAX_RETRIES = 4;

async function fetchTokenData(address) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await axios.get(
      `https://tokensniffer.com/api/v2/tokens/1/${address}`,
      {
        headers: {
          accept: "application/json",
        },
        params: {
          apikey: SNIFFER_API,
          include_metrics: "true",
          include_tests: "false",
          block_until_ready: "false",
        },
      }
    );

    const data = response.data;
    if (
      data &&
      data.pools &&
      data.pools[0] &&
      data.pools[0].total_supply &&
      Number(data.pools[0].lock_balance) >= 0 &&
      data.pools[0].burn_balance &&
      data.pools[0].locks
    ) {
      return data;
    }

    console.log(`Attempt ${attempt + 1} failed. Retrying...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Max retries reached. Could not fetch valid data.");
}

// Function to fetch token information
async function tokenInfo(chatId, walletAddress) {
  const apiKey = DEXTOOL_API;
  const apiUrl = "https://api.dextools.io/v1/token";
  const address = walletAddress;
  const userState = userStates.get(chatId);
  console.log(userState);

  try {
    const response = await axios.get(apiUrl, {
      params: {
        chain: "ether",
        address: address,
      },
      headers: {
        accept: "application/json",
        "X-API-Key": apiKey,
      },
    });

    const tokenInfo = response?.data;

    const lockTransaction = tokenInfo?.data?.audit?.lockTransactions;

    const name = tokenInfo?.data?.name || "Unknown";
    const symbol = tokenInfo?.data?.symbol || "N/A";
    const chain = tokenInfo?.data?.chain || "N/A";
    const mint = tokenInfo?.data.audit.mint || "N/A";
    const codeV = tokenInfo?.data?.audit?.is_contract_renounced || "N/A";
    const audited = tokenInfo?.data?.audit?.provider || "Unknown";
    const verified = tokenInfo?.data?.audit?.codeVerified || "N/A";
    const creationBlock = tokenInfo?.data?.creationBlock || "N/A";
    const txCount = tokenInfo?.data?.metrics?.txCount || "N/A";
    const decimals = tokenInfo?.data?.decimals || 18;
    const circulatingSupply =
      tokenInfo?.data?.metrics?.circulatingSupply || "N/A";
    const currentPrice = tokenInfo?.data?.reprPair?.price;
    const pairAddress = tokenInfo?.data?.reprPair?.id?.pair;

    const options = {
      parse_mode: "HTML",
      reply_markup: getSocialKeyboard(tokenInfo?.data?.links),
    };

    const blockTime = await provider.getBlock(creationBlock);
    const creationTime = new Date(Number(blockTime?.timestamp * 1000));
    const date1 = dayjs(new Date());
    const date2 = dayjs(creationTime);
    const diff = date1.diff(date2, "day");

    const url = `https://api.gopluslabs.io/api/v1/token_security/${1}?contract_addresses=${address}`;
    const { data } = await axios.get(url);

    const token = data?.result?.[address?.toLowerCase()];

    const {
      creator_address,
      total_supply,
      holder_count,
      holders,
      owner_address,
      lp_holders,
      lp_total_supply,
    } = token;

    const taxes = await fetchTokenData(address);
    const buy_tax = taxes?.swap_simulation?.buy_fee;
    const sell_tax = taxes?.swap_simulation?.sell_fee;

    // let isLpLocked = 0;
    // let lpHolderName, lpHolderPercent, totalLockTime;

    // if (lp_holders?.length > 0) {
    //   lpHolderName = lp_holders?.[0]?.tag;
    //   isLpLocked = lp_holders?.[0]?.is_locked;
    //   lpHolderPercent = Number(lp_holders?.[0]?.percent * 100).toFixed(2);
    //   const lpHolderTime = lp_holders?.[0].locked_detail?.[0];
    //   const lockStartTime = dayjs(lpHolderTime?.opt_time);
    //   const lockEndTime = dayjs(lpHolderTime?.end_time);
    //   totalLockTime = lockEndTime.diff(lockStartTime, "day");
    // }

    const lpLock = taxes?.pools?.[0]?.locks;
    const lp_total_supply1 = Number(
      taxes?.pools?.[0]?.total_supply / 10 ** 18
    ).toFixed(2);
    const lp_burn_balance =
      taxes?.pools?.[0]?.burn_balance > 1000
        ? Number(taxes?.pools?.[0]?.burn_balance / 10 ** 18).toFixed(2)
        : 0;

    const lpHolderName = lpLock?.[0]?.name;
    const lockEndTime = lpLock?.[0]?.end_time;
    const lockStartTime = dayjs(new Date());
    const newlockEndTime = dayjs(dayjs.unix(lockEndTime));
    const totalLockTime = newlockEndTime.diff(lockStartTime, "day");

    const divideSupply =
      taxes?.pools?.[0]?.lock_balance === 0 &&
      taxes?.pools?.[0]?.burn_balance > 1000 &&
      taxes?.pools?.[0]?.burn_balance > taxes?.pools?.[0]?.lock_balance
        ? taxes?.pools?.[0]?.burn_balance
        : taxes?.pools?.[0]?.lock_balance;

    const lpHolderPercent = (
      (Number(divideSupply) * 100) /
      Number(taxes?.pools?.[0]?.total_supply)
    ).toFixed(2);

    let totalHoldings = 0;

    taxes.balances.top_holders?.map((holder) => {
      if (!holder.is_contract) {
        totalHoldings += holder.balance;
      }
      return;
    });

    const totalHolderPercent =
      (Number(totalHoldings) * 100) / Number(total_supply);

    const totalSupplyWithDecimals = total_supply * 10 ** decimals;

    const circulating = totalSupplyWithDecimals / Math.pow(10, decimals);
    const marketCapital = Number(circulating * currentPrice).toFixed(0);

    const message = `
    Token Information:
    📛 𝙽𝚊𝚖𝚎: ${name}
    🥇 𝚂𝚢𝚖𝚋𝚘𝚕: ${symbol}
    ⛓ 𝙽𝚎𝚝𝚠𝚘𝚛𝚔: ETH
    ${codeV && `📜 𝙲𝚘𝚗𝚝𝚛𝚊𝚌𝚝 𝚁𝚎𝚗𝚘𝚞𝚗𝚌𝚎𝚍:  Renounced`}
    ${codeV ? "" : `📜 𝙲𝚘𝚗𝚝𝚛𝚊𝚌𝚝 𝙾𝚠𝚗𝚎𝚛:`} ${codeV ? "" : owner_address}
    🍯 𝙷𝚘𝚗𝚎𝚢𝚙𝚘𝚝: ${lockTransaction ? `YES` : `NO`}
    ✅ 𝙲𝚘𝚗𝚝𝚛𝚊𝚌𝚝 𝚟𝚎𝚛𝚒𝚏𝚒𝚎𝚍: ${verified}
    👤 𝙲𝚛𝚎𝚊𝚝𝚘𝚛: ${creator_address}
    ⏳ 𝙰𝚐𝚎: ${diff} days
    💰 𝙼𝙲: $${(marketCapital > 10 ** 6
      ? marketCapital / 10 ** 6
      : marketCapital / 10 ** 3
    ).toFixed(2)}${marketCapital > 10 ** 6 ? "M" : "K"}
    💲 𝙲𝚞𝚛𝚛𝚎𝚗𝚝 𝙿𝚛𝚒𝚌𝚎: ${currentPrice?.toFixed(6)}
    💧 𝚃𝚘𝚝𝚊𝚕-𝙻𝚒𝚚𝚞𝚒𝚍𝚒𝚝𝚢: ${Number(lp_total_supply ?? lp_total_supply1).toFixed(
      2
    )} lp-tokens
    🔒 𝙻𝙿 𝙻𝚘𝚌𝚔: ${`${lpHolderPercent}% locked ${
      lockEndTime ? `for ${totalLockTime} days` : ""
    } on ${lpHolderName ?? "Dead Address"}`}
    🔥 𝙱𝚞𝚛𝚗 𝙱𝚊𝚕𝚊𝚗𝚌𝚎: ${
      lp_burn_balance > 0
        ? ((lp_burn_balance * 100) / Number(lp_total_supply1)).toFixed(0)
        : 0
    } %
    📈 𝙱𝚞𝚢-𝚃𝚊𝚡: ${buy_tax ?? 0}%
    📉 𝚂𝚎𝚕𝚕-𝚃𝚊𝚡: ${sell_tax ?? 0}%
    🙋 𝚃𝚘𝚝𝚊𝚕-𝙷𝚘𝚕𝚍𝚎𝚛𝚜: ${holder_count} Holders
    🔄 𝚃𝚘𝚝𝚊𝚕-𝚃𝚡𝚗𝚜: ${txCount} Txns
    🔝 𝚃𝚘𝚙 10 𝙷𝚘𝚕𝚍𝚎𝚛𝚜: ${Number(totalHolderPercent).toFixed(2)}%
    📦 𝚃𝚘𝚝𝚊𝚕-𝚂𝚞𝚙𝚙𝚕𝚢: ${Number(total_supply).toFixed(0)} ${symbol}
    <a href="https://etherscan.io/address/${address}">Scan</a> | <a href="https://app.uniswap.org/#/swap?&outputCurrency=${address}">Trade</a> | <a href="https://www.dextools.io/app/en/ether/pair-explorer/${pairAddress}">Chart</a> 
   `;

    console.log(message);
    // 0x6448Be0ca45a7581D9c4C9DD665e14ec60B25113
    //   const message = `
    //    Token Information:
    //    📛 𝙽𝚊𝚖𝚎: ${name}
    //    🥇 𝚂𝚢𝚖𝚋𝚘𝚕: ${symbol}
    //    📈 𝚃𝚘𝚝𝚊𝚕 𝚂𝚞𝚙𝚙𝚕𝚢: ${tokenSupply}
    //    ⚡️  𝙽𝚎𝚝𝚠𝚘𝚛𝚔: ETH
    //    💠 𝙼𝚊𝚛𝚔𝚎𝚝𝙲𝚊𝚙: ${maxSupply}
    //    📇 𝙲𝚘𝚗𝚝𝚛𝚊𝚌𝚝 𝚁𝚎𝚗𝚘𝚞𝚗𝚌𝚎𝚍:${codeV ? `✅` : `❌`}
    //    🍯 𝙷𝚘𝚗𝚎𝚢𝙿𝚘𝚝:${lockTransaction ? `✅` : `❌`}
    //    💧 𝙼𝚒𝚗𝚝𝚊𝚋𝚕𝚎: ${mint ? `✅` : `❌`}
    //    🥇 Code verified :${verified}
    //  `;

    bot.sendMessage(chatId, message, options);
  } catch (error) {
    console.error("Error calling the API:", error);
    bot.sendMessage(
      chatId,
      "An error occurred while fetching token information."
    );
  }
}

const tempStorage = {};

function storeData(data) {
  const id = Date.now().toString(); // using timestamp as an identifier for simplicity
  tempStorage[id] = data;
  setTimeout(() => delete tempStorage[id], 600000); // delete after 10 minutes
  return id;
}

function getSocialKeyboard(receivedData) {
  const id = storeData(receivedData);

  return {
    inline_keyboard: [
      [
        {
          text: "🔎 Check Social Information",
          callback_data: `social:${id}`,
        },
      ],
    ],
  };
}
// if (userState === 'social') {

// Then, when the user clicks the button and you handle the callback
bot.on("callback_query", (callbackQuery) => {
  const data = callbackQuery.data;

  const chatId = callbackQuery.message.chat.id;
  // Split the data to extract your sent data
  const [action, identifier] = data.split(":");
  const receivedData = tempStorage[identifier];

  const message = `
   𝚂𝚘𝚌𝚒𝚊𝚕 𝙸𝚗𝚏𝚘𝚛𝚖𝚊𝚝𝚒𝚘𝚗:
   𝙱𝚒𝚝𝚋𝚞𝚌𝚔𝚎𝚝: ${receivedData?.bitbucket ?? ""},
   𝙳𝚒𝚜𝚌𝚘𝚛𝚍: ${receivedData?.discord ?? ""},
   𝙵𝚊𝚌𝚎𝚋𝚘𝚘𝚔: ${receivedData?.facebook ?? ""},
   𝙶𝚒𝚝𝚑𝚞𝚋: ${receivedData?.github ?? ""},
   𝙸𝚗𝚜𝚝𝚊𝚐𝚛𝚊𝚖: ${receivedData?.instagram ?? ""},
   𝙻𝚒𝚗𝚔𝚎𝚍𝚒𝚗: ${receivedData?.linkedin ?? ""},
   𝙼𝚎𝚍𝚒𝚞𝚖: ${receivedData?.medium ?? ""},
   𝚁𝚎𝚍𝚍𝚒𝚝: ${receivedData?.reddit ?? ""},
   𝚃𝚎𝚕𝚎𝚐𝚛𝚊𝚖: ${receivedData?.telegram ?? ""},
   𝚃𝚒𝚔𝚝𝚘𝚔: ${receivedData?.tiktok ?? ""},
   𝚃𝚠𝚒𝚝𝚝𝚎𝚛: ${receivedData?.twitter ?? ""},
   𝚆𝚎𝚋𝚜𝚒𝚝𝚎: ${receivedData?.website ?? ""},
   𝚈𝚘𝚞𝚝𝚞𝚋𝚎: ${receivedData?.youtube ?? ""}
  `;
  // const parsedData = JSON.parse(receivedData);

  if (action === "social") {
    bot.sendMessage(chatId, message);

    // Now, you can access the receivedData and use it as needed
    // bot.sendMessage(chatId, parsedData);
  }
});

const provider = new ethers.providers.WebSocketProvider(
  "wss://fluent-fluent-leaf.discover.quiknode.pro/9f014bfe15ae79f5da3b34dcc191267e37098ac1/"
);

const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Function to send a message alert to Telegram
async function sendTelegramMessage(message, b) {
  console.log(b);
  const url = `${BASE_URL}/sendMessage`;
  const data = {
    chat_id: b,
    text: message,
    parse_mode: "HTML",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const responseData = await response.json();
    if (responseData.ok) {
      console.log("Telegram message sent successfully.");
    } else {
      console.error(
        "Failed to send Telegram message:",
        responseData.description
      );
    }
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
}

// Function to process a transaction
const processTransaction = async (tx, a, b) => {
  try {
    // console.log(a,b)
    const transaction = await provider.getTransaction(tx);

    const etherValue = ethers.utils.formatEther(transaction?.value.toNumber());
    // console.log(etherValue)
    for (let i = 0; i < a.length; i++) {
      // console.log(a[i],'call')
      // sendTelegramMessage('ok',b[i]);
      if (
        transaction?.to.toLowerCase() === a[i].toLowerCase() ||
        transaction?.from.toLowerCase() === a[i].toLowerCase()
      ) {
        if (etherValue <= MIN_ETH) {
          console.log("called");
          const alertMessage = `Alert: A transaction has been processed. Transaction details: https://etherscan.io/tx/${transaction.hash}`;
          // console.log(transaction)
          sendTelegramMessage(alertMessage, b[i]);
        }
      }
    }
  } catch (err) {
    // console.log('Error processing transaction:', err);
  }
};

const factory = new ethers.Contract(
  UNISWAP_FACTORY_ADDRESS,
  factoryAbi,
  provider
);

factory.on("PairCreated", async (token0, token1, pairAddress) => {
  try {
    console.log(`
    New pair detected
    =================
    token0: ${token0}
    token1: ${token1}
    pairAddress: ${pairAddress}
  `);

    if (
      token0?.toLowerCase() !== WETH?.toLowerCase() &&
      token1?.toLowerCase() !== WETH?.toLowerCase()
    ) {
      console.log(`Liquidity not added with WETH`);
      return;
    }

    //The quote currency needs to be NATIVE_CURRENCY (we will pay with NATIVE_CURRENCY)
    let tokenIn, tokenOut, isToken0Native;
    if (token0?.toLowerCase() === WETH?.toLowerCase()) {
      tokenIn = token0;
      tokenOut = token1;
      isToken0Native = true;
    }

    if (token1?.toLowerCase() == WETH?.toLowerCase()) {
      tokenIn = token1;
      tokenOut = token0;
      isToken0Native = false;
    }

    const lpContract = new ethers.Contract(pairAddress, lpAbi, provider);
    const reserves = await lpContract.getReserves();

    if (
      (isToken0Native &&
        Number(formatEther(reserves[0]?.toString())) <= MIN_ETH_LIQUIDITY) ||
      (!isToken0Native &&
        Number(formatEther(reserves[1]?.toString())) <= MIN_ETH_LIQUIDITY)
    ) {
      console.log("Value is less than expected");
      return;
    }

    const apiKey = DEXTOOL_API;

    const apiUrl = "https://api.dextools.io/v1/token";

    const response = await axios.get(apiUrl, {
      params: {
        chain: "ether",
        address: tokenOut,
      },
      headers: {
        accept: "application/json",
        "X-API-Key": apiKey,
      },
    });

    const tokenInfo = response?.data;

    const lockTransaction = tokenInfo?.data?.audit?.lockTransactions || "N/A";
    const name = tokenInfo?.data?.name || "Unknown";
    const symbol = tokenInfo?.data?.symbol || "N/A";
    const codeV = tokenInfo?.data?.audit?.is_contract_renounced || "N/A";
    const verified = tokenInfo?.data?.audit?.codeVerified || "N/A";
    const creationBlock = tokenInfo?.data?.creationBlock || "N/A";
    const txCount = tokenInfo?.data?.metrics?.txCount || "N/A";
    const decimals = tokenInfo?.data?.decimals || 18;
    // const circulatingSupply =
    //   tokenInfo?.data?.metrics?.circulatingSupply || "N/A";
    const currentPrice = tokenInfo?.data?.reprPair?.price;

    const blockTime = await provider.getBlock(creationBlock);
    const creationTime = new Date(Number(blockTime?.timestamp * 1000));
    const date1 = dayjs(new Date());
    const date2 = dayjs(creationTime);
    const diff = date1.diff(date2, "day");

    const url = `https://api.gopluslabs.io/api/v1/token_security/${1}?contract_addresses=${tokenOut}`;
    const { data } = await axios.get(url);

    const token = data?.result?.[tokenOut?.toLowerCase()];

    const {
      creator_address,
      total_supply,
      holder_count,
      holders,
      owner_address,
      lp_holders,
      lp_total_supply,
    } = token;

    const taxes = await fetchTokenData(tokenOut);
    const buy_tax = taxes?.swap_simulation?.buy_fee;
    const sell_tax = taxes?.swap_simulation?.sell_fee;

    // let isLpLocked = 0;
    // let lpHolderName, lpHolderPercent, totalLockTime;

    // if (lp_holders?.length > 0) {
    //   lpHolderName = lp_holders?.[0]?.tag;
    //   isLpLocked = lp_holders?.[0]?.is_locked;
    //   lpHolderPercent = Number(lp_holders?.[0]?.percent * 100).toFixed(2);
    //   const lpHolderTime = lp_holders?.[0].locked_detail?.[0];
    //   const lockStartTime = dayjs(lpHolderTime?.opt_time);
    //   const lockEndTime = dayjs(lpHolderTime?.end_time);
    //   totalLockTime = lockEndTime.diff(lockStartTime, "day");
    // }

    const lpLock = taxes?.pools?.[0]?.locks;
    const lp_total_supply1 = Number(
      taxes?.pools?.[0]?.total_supply / 10 ** 18
    ).toFixed(2);
    const lp_burn_balance =
      taxes?.pools?.[0]?.burn_balance > 1000
        ? Number(taxes?.pools?.[0]?.burn_balance / 10 ** 18).toFixed(2)
        : 0;

    const lpHolderName = lpLock?.[0]?.name;
    const lockEndTime = lpLock?.[0]?.end_time;
    const lockStartTime = dayjs(new Date());
    const newlockEndTime = dayjs(dayjs.unix(lockEndTime));
    const totalLockTime = newlockEndTime.diff(lockStartTime, "day");

    const divideSupply =
      taxes?.pools?.[0]?.lock_balance === 0 &&
      taxes?.pools?.[0]?.burn_balance > 1000 &&
      taxes?.pools?.[0]?.burn_balance > taxes?.pools?.[0]?.lock_balance
        ? taxes?.pools?.[0]?.burn_balance
        : taxes?.pools?.[0]?.lock_balance;

    const lpHolderPercent = (
      (Number(divideSupply) * 100) /
      Number(taxes?.pools?.[0]?.total_supply)
    ).toFixed(2);

    let totalHoldings = 0;

    taxes.balances.top_holders?.map((holder) => {
      if (!holder.is_contract) {
        totalHoldings += holder.balance;
      }
      return;
    });

    const totalHolderPercent =
      (Number(totalHoldings) * 100) / Number(total_supply);

    const totalSupplyWithDecimals = total_supply * 10 ** decimals;

    const circulating = totalSupplyWithDecimals / Math.pow(10, decimals);
    const marketCapital = Number(circulating * currentPrice).toFixed(0);
    if (lpHolderPercent <= 0 && !codeV)
      return console.log("renounce false or liquidity not locked");

    const message = `
    Token Information:
    📛 𝙽𝚊𝚖𝚎: ${name}
    🥇 𝚂𝚢𝚖𝚋𝚘𝚕: ${symbol}
    ⛓ 𝙽𝚎𝚝𝚠𝚘𝚛𝚔: ETH
    ${codeV && `📜 𝙲𝚘𝚗𝚝𝚛𝚊𝚌𝚝 𝚁𝚎𝚗𝚘𝚞𝚗𝚌𝚎𝚍:  Renounced`}
    ${codeV ? "" : `📜 𝙲𝚘𝚗𝚝𝚛𝚊𝚌𝚝 𝙾𝚠𝚗𝚎𝚛:`} ${codeV ? "" : owner_address}
    🍯 𝙷𝚘𝚗𝚎𝚢𝚙𝚘𝚝: ${lockTransaction ? `YES` : `NO`}
    ✅ 𝙲𝚘𝚗𝚝𝚛𝚊𝚌𝚝 𝚟𝚎𝚛𝚒𝚏𝚒𝚎𝚍: ${verified}
    👤 𝙲𝚛𝚎𝚊𝚝𝚘𝚛: ${creator_address}
    ⏳ 𝙰𝚐𝚎: ${diff} days
    💰 𝙼𝙲: $${(marketCapital > 10 ** 6
      ? marketCapital / 10 ** 6
      : marketCapital / 10 ** 3
    ).toFixed(2)}${marketCapital > 10 ** 6 ? "M" : "K"}
    💲 𝙲𝚞𝚛𝚛𝚎𝚗𝚝 𝙿𝚛𝚒𝚌𝚎: ${currentPrice?.toFixed(6)}
    💧 𝚃𝚘𝚝𝚊𝚕-𝙻𝚒𝚚𝚞𝚒𝚍𝚒𝚝𝚢: ${Number(lp_total_supply ?? lp_total_supply1).toFixed(
      2
    )} lp-tokens
    🔒 𝙻𝙿 𝙻𝚘𝚌𝚔: ${`${lpHolderPercent}% locked ${
      lockEndTime ? `for ${totalLockTime} days` : ""
    } on ${lpHolderName ?? "Dead Address"}`}
    🔥 𝙱𝚞𝚛𝚗 𝙱𝚊𝚕𝚊𝚗𝚌𝚎: ${
      lp_burn_balance > 0
        ? ((lp_burn_balance * 100) / Number(lp_total_supply1)).toFixed(0)
        : 0
    } %
    📈 𝙱𝚞𝚢-𝚃𝚊𝚡: ${buy_tax ?? 0}%
    📉 𝚂𝚎𝚕𝚕-𝚃𝚊𝚡: ${sell_tax ?? 0}%
    🙋 𝚃𝚘𝚝𝚊𝚕-𝙷𝚘𝚕𝚍𝚎𝚛𝚜: ${holder_count} Holders
    🔄 𝚃𝚘𝚝𝚊𝚕-𝚃𝚡𝚗𝚜: ${txCount} Txns
    🔝 𝚃𝚘𝚙 10 𝙷𝚘𝚕𝚍𝚎𝚛𝚜: ${Number(totalHolderPercent).toFixed(2)}%
    📦 𝚃𝚘𝚝𝚊𝚕-𝚂𝚞𝚙𝚙𝚕𝚢: ${Number(total_supply).toFixed(0)} ${symbol}
    <a href="https://etherscan.io/address/${tokenOut}">Scan</a> | <a href="https://app.uniswap.org/#/swap?&outputCurrency=${tokenOut}">Trade</a> | <a href="https://www.dextools.io/app/en/ether/pair-explorer/${pairAddress}">Chart</a> 
   `;

    const rugCollectionRef = collection(db, "rug");
    const q = query(rugCollectionRef, where("status", "==", "true"));

    getDocs(q)
      .then((querySnapshot) => {
        // Step 2: Extract chat IDs from the documents
        const chatIds = [];
        console.log(chatIds);
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data && data.chatId) {
            chatIds.push(data.chatId);
          }
        });

        // Step 3: Use the extracted chat IDs dynamically
        chatIds.forEach((chatId) => {
          sendTelegramMessage(message, chatId.toString());

          // You can perform actions for each chat ID here
        });
      })
      .catch((error) => {
        console.error("Error getting documents from Firestore:", error);
      });

    console.log("message", message);
  } catch (e) {
    console.log(e);
  }
});

// (async () => {
//   const apiKey = DEXTOOL_API;
//   const apiKeySniffer = SNIFFER_API;
//   // const address = "0xa62894d5196bc44e4c3978400ad07e7b30352372";
//   const address = "0x9325372ea94a3882aBC180a3D8A314A30CFC6d35";
//   // const address = "0x4A8c065bB3Dd9cf2C7e6978319F7D3eB7BEb7CEd";
//   // const address = "0x5a8f8922503C72D5d26Eb1d69e18A7a0085eEB48";
//   // const address = "0x81EF51FcE2b14874CB840515faCf5BE667ea4d8F"; //pinksale
//   try {
//     const apiUrl = "https://api.dextools.io/v1/token";

//     const response = await axios.get(apiUrl, {
//       params: {
//         chain: "ether",
//         address: address,
//       },
//       headers: {
//         accept: "application/json",
//         "X-API-Key": apiKey,
//       },
//     });

//     const tokenInfo = response?.data;
//     // console.log(tokenInfo, "token info");
//     // Process tokenInfo and send a message to the user

//     const lockTransaction = tokenInfo?.data?.audit?.lockTransactions;

//     const name = tokenInfo?.data?.name || "Unknown";
//     const symbol = tokenInfo?.data?.symbol || "N/A";
//     const chain = tokenInfo?.data?.chain || "N/A";
//     const mint = tokenInfo?.data.audit.mint || "N/A";
//     const codeV = tokenInfo?.data?.audit?.is_contract_renounced || "N/A";
//     const audited = tokenInfo?.data?.audit?.provider || "Unknown";
//     const verified = tokenInfo?.data?.audit?.codeVerified || "N/A";
//     const creationBlock = tokenInfo?.data?.creationBlock || "N/A";
//     const txCount = tokenInfo?.data?.metrics?.txCount || "N/A";
//     const decimals = tokenInfo?.data?.decimals || 18;
//     const circulatingSupply =
//       tokenInfo?.data?.metrics?.circulatingSupply || "N/A";
//     const currentPrice = tokenInfo?.data?.reprPair?.price;
//     const options = {
//       reply_markup: getSocialKeyboard(tokenInfo?.data?.links),
//     };

//     const blockTime = await provider.getBlock(creationBlock);
//     const creationTime = new Date(Number(blockTime?.timestamp * 1000));
//     const date1 = dayjs(new Date());
//     const date2 = dayjs(creationTime);
//     const diff = date1.diff(date2, "day");

//     const url = `https://api.gopluslabs.io/api/v1/token_security/${1}?contract_addresses=${address}`;
//     const { data } = await axios.get(url);

//     const token = data?.result?.[address?.toLowerCase()];

//     const {
//       creator_address,
//       total_supply,
//       holder_count,
//       holders,
//       owner_address,
//       lp_holders,
//       lp_total_supply,
//     } = token;

//     // const { data: taxes } = await axios.get(
//     //   `https://tokensniffer.com/api/v2/tokens/1/${address}`,
//     //   {
//     //     headers: {
//     //       accept: "application/json",
//     //     },
//     //     params: {
//     //       apikey: apiKeySniffer,
//     //       include_metrics: "true",
//     //       include_tests: "false",
//     //       block_until_ready: "false",
//     //     },
//     //   }
//     // );
//     const taxes = await fetchTokenData(address);
//     const buy_tax = taxes?.swap_simulation?.buy_fee;
//     const sell_tax = taxes?.swap_simulation?.sell_fee;

//     // let isLpLocked = 0;
//     // let lpHolderName, lpHolderPercent, totalLockTime;

//     // if (lp_holders?.length > 0) {
//     //   lpHolderName = lp_holders?.[0]?.tag;
//     //   isLpLocked = lp_holders?.[0]?.is_locked;
//     //   lpHolderPercent = Number(lp_holders?.[0]?.percent * 100).toFixed(2);
//     //   const lpHolderTime = lp_holders?.[0].locked_detail?.[0];
//     //   const lockStartTime = dayjs(lpHolderTime?.opt_time);
//     //   const lockEndTime = dayjs(lpHolderTime?.end_time);
//     //   totalLockTime = lockEndTime.diff(lockStartTime, "day");
//     // }

//     const lpLock = taxes?.pools?.[0]?.locks;
//     const lp_total_supply1 = Number(
//       taxes?.pools?.[0]?.total_supply / 10 ** 18
//     ).toFixed(2);
//     const lp_burn_balance =
//       taxes?.pools?.[0]?.burn_balance > 1000
//         ? Number(taxes?.pools?.[0]?.burn_balance / 10 ** 18).toFixed(2)
//         : 0;

//     const lpHolderName = lpLock?.[0]?.name;
//     const lockEndTime = lpLock?.[0]?.end_time;
//     const lockStartTime = dayjs(new Date());
//     const newlockEndTime = dayjs(dayjs.unix(lockEndTime));
//     const totalLockTime = newlockEndTime.diff(lockStartTime, "day");

//     const divideSupply =
//       taxes?.pools?.[0]?.lock_balance === 0 &&
//       taxes?.pools?.[0]?.burn_balance > 1000 &&
//       taxes?.pools?.[0]?.burn_balance > taxes?.pools?.[0]?.lock_balance
//         ? taxes?.pools?.[0]?.burn_balance
//         : taxes?.pools?.[0]?.lock_balance;

//     const lpHolderPercent = (
//       (Number(divideSupply) * 100) /
//       Number(taxes?.pools?.[0]?.total_supply)
//     ).toFixed(2);

//     let totalHoldings = 0;

//     holders?.map((holder) => {
//       totalHoldings += holder?.percent * 100;
//       return;
//     });

//     const totalSupplyWithDecimals = total_supply * 10 ** decimals;

//     const circulating = totalSupplyWithDecimals / Math.pow(10, decimals);

//     const message = `
//     Token Information:
//     📛 𝙽𝚊𝚖𝚎: ${name}
//     🥇 𝚂𝚢𝚖𝚋𝚘𝚕: ${symbol}
//     ⛓ 𝙽𝚎𝚝𝚠𝚘𝚛𝚔: ETH
//     ${codeV && `📜 𝙲𝚘𝚗𝚝𝚛𝚊𝚌𝚝 𝚁𝚎𝚗𝚘𝚞𝚗𝚌𝚎𝚍:  YES`}
//     ${codeV ? "" : `📜 𝙲𝚘𝚗𝚝𝚛𝚊𝚌𝚝 𝙾𝚠𝚗𝚎𝚛:`} ${codeV ? "" : owner_address}
//     🍯 𝙷𝚘𝚗𝚎𝚢𝙿𝚘𝚝: ${lockTransaction ? `YES` : `NO`}
//     ✅ 𝙲𝚘𝚍𝚎 𝚟𝚎𝚛𝚒𝚏𝚒𝚎𝚍: ${verified}
//     👤 𝙲𝚛𝚎𝚊𝚝𝚘𝚛: ${creator_address}
//     ⏳ 𝙲𝚛𝚎𝚊𝚝𝚒𝚘𝚗-𝚃𝚒𝚖𝚎: ${diff} days
//     💰 𝙼𝚊𝚛𝚔𝚎𝚝-𝙲𝚊𝚙𝚒𝚝𝚊𝚕: $${Number(circulating * currentPrice).toFixed(0)}
//     💲 𝙲𝚞𝚛𝚛𝚎𝚗𝚝 𝙿𝚛𝚒𝚌𝚎: ${currentPrice?.toFixed(6)}
//     💧 𝚃𝚘𝚝𝚊𝚕-𝙻𝚒𝚚𝚞𝚒𝚍𝚒𝚝𝚢: ${Number(lp_total_supply ?? lp_total_supply1).toFixed(
//       2
//     )} lp-tokens
//     🔒 𝙻𝙿 𝙻𝚘𝚌𝚔: ${`${lpHolderPercent}% locked ${
//       lockEndTime ? `for ${totalLockTime} days` : ""
//     } on ${lpHolderName ?? "Dead Address"}`}
//     🔥 𝙱𝚞𝚛𝚗 𝙱𝚊𝚕𝚊𝚗𝚌𝚎: ${lp_burn_balance ?? 0}
//     📈 𝙱𝚞𝚢-𝚃𝚊𝚡: ${buy_tax ?? 0}
//     📉 𝚂𝚎𝚕𝚕-𝚃𝚊𝚡: ${sell_tax ?? 0}
//     🙋 𝚃𝚘𝚝𝚊𝚕-𝙷𝚘𝚕𝚍𝚎𝚛𝚜: ${holder_count}
//     🔄 𝚃𝚘𝚝𝚊𝚕-𝚃𝚛𝚡: ${txCount}
//     🔝 𝚃𝚘𝚙 10 𝙷𝚘𝚕𝚍𝚎𝚛𝚜: ${totalHoldings}%
//     📦 𝚃𝚘𝚝𝚊𝚕-𝚂𝚞𝚙𝚙𝚕𝚢: ${total_supply}
//     🔎 𝙴𝚡𝚙𝚕𝚘𝚛𝚎𝚛: <a href="https://etherscan.io/address/${address}">Explorer</a>
//    `;
//     console.log(message);
//   } catch (e) {
//     console.log(e);
//   }
// })();

app.get("/", (req, res) => res.send(`Server running on port ${PORT}`));

process.on("uncaughtException", (err, origin) => {
  fs.writeSync(
    process.stderr.fd,
    `Caught exception: ${err}\n` + `Exception origin: ${origin}`
  );
});
