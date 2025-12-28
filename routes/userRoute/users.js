import { Router } from "express";
import { db } from "../../db/connectDB.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const users = await db.collection("users").find().toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const user = req.body;
    const result = await db.collection("users").insertOne(user);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
