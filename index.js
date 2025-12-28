import cors from "cors";
import express from "express";

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());

// routes
app.get("/", (req, res) => {
  res.send(" API is running");
});

// server
app.listen(port, () => {
  console.log(` Server running on http://localhost:${port}`);
});
