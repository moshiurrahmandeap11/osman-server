import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db/connectDB.js";

import timelineCategoriesRoutes from "./routes/timelineRoute/timeline-categories.js";
import timelinePostRequestsRouter from "./routes/timelineRoute/timeline-posts-requests.js";
import timelinePostsRouter from "./routes/timelineRoute/timeline-posts.js";
import users from "./routes/userRoute/users.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


//  serve static files
app.use("/api/uploads", express.static(path.join(__dirname, "public/uploads")));


// db connect
await connectDB();

// routes
app.use("/api/users", users);
app.use("/api/timeline-categories", timelineCategoriesRoutes);
app.use("/api/timeline-posts", timelinePostsRouter);
app.use("/api/timeline-post-requests", timelinePostRequestsRouter);

app.get("/", (req, res) => {
  res.send("🔥 API is running");
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
