import "dotenv/config";

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is not defined in environmental variable");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environmental variable");
}

if (!process.env.ACCESS_TOKEN_SECRET) {
  throw new Error(
    "ACCESS_TOKEN_SECRET is not defined in environmental variable",
  );
}

if (!process.env.REFRESH_TOKEN_SECRET) {
  throw new Error(
    "REFRESH_TOKEN_SECRET is not defined in environmental variable",
  );
}

if (!process.env.NODE_ENV) {
  throw new Error("NODE_ENV is not defined in environmental variable");
}

if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID is not defined in environmental variable");
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(
    "GOOGLE_CLIENT_SECRET is not defined in environmental variable",
  );
}

if (!process.env.GOOGLE_REFRESH_TOKEN) {
  throw new Error(
    "GOOGLE_REFRESH_TOKEN is not defined in environmental variable",
  );
}

if (!process.env.GOOGLE_USER) {
  throw new Error("GOOGLE_USER is not defined in environmental variable");
}

const config = {
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_USER: process.env.GOOGLE_USER,
};

export default config;
