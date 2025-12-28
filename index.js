import cors from "cors";
import express from "express";
import { connectDB } from "./db/connectDB.js";

import users from "./routes/userRoute/users.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// db connect
await connectDB();

// routes
app.use("/api/users", users);

app.get("/", (req, res) => {
  res.send("🔥 API is running");
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
