const functions = require('@google-cloud/functions-framework');
const mailgun = require("mailgun-js")({
  apiKey: "39755198470b529b3fad0fc3114dd27a-f68a26c9-989e9c1b",
  domain: "sujendragharat.me"
});
require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

console.log(process.env.DB_HOST, "DB HOST");

// Initialize Sequelize
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: process.env.DB_DIALECT
});

sequelize.sync()
  .then(() => console.log('All models were synchronized successfully.'))
  .catch(error => console.error('Error synchronizing models:', error));

// Define User model
const User = sequelize.define("user", {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
    },
    first_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    last_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    verificationToken: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    tokenExpiryDate: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    updatedAt: 'account_updated',
    createdAt: 'account_created'
});

async function testDatabaseConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connection successful.');
  } catch (error) {
    console.error('Error connecting to the database:', error);
  }
}

function sendVerificationEmail(data) {
  return new Promise((resolve, reject) => {
    console.log(data, "data inside send email verification ")
    try {
      if (!(data && data["username"] && data["verificationLink"])) {
        reject(new Error("Username and Verification Link field is required."));
      }

      const { username, verificationLink } = data;

      const emailData = {
        from: "sujendra <sgharat297@gmail.com>",
        to: username,
        subject: "Email Verification",
        text: `Please click the following link to verify your email address: ${verificationLink} `
      };

      mailgun.messages().send(emailData, (error, body) => {
        if (error) {
          reject(new Error("Error sending verification email."));
        } else {
          resolve("Verification email sent successfully.");
        }
      });
    } catch (error) {
      reject(new Error("Internal server error."));
    }
  });
}

functions.cloudEvent('sendEmail', async cloudEvent => {
  const base64name = cloudEvent.data.message.data;

  if (base64name) {
    await testDatabaseConnection();

    const _data = JSON.parse(Buffer.from(base64name, 'base64').toString());
    console.log("base64 present")

    // Calculate token expiry time (2 minutes from now)
    const tokenExpiryDate = new Date(Date.now() + 120000);

    try {
      // Update token expiry date for existing user in the database
      const result = await User.update({ tokenExpiryDate: tokenExpiryDate }, { where: { username: _data.username } });
      console.log(result, tokenExpiryDate, "tokenExpirytData")
      // Send verification email
      sendVerificationEmail(_data)
        .then(response => console.log(response))
        .catch(error => console.error(error));
    } catch (error) {
      console.error('Error updating token expiry date:', error);
    }

  } else {
    console.error("Base64name is falsy. Unable to proceed.");
  }
});
