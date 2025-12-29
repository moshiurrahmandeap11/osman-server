// routes/timeline-posts.js
import { Router } from "express";
import { ObjectId } from "mongodb";
import { db } from "../../db/connectDB.js";
import { deleteFile, getFileUrl, uploadSingle } from "../../middleware/upload.js";

const router = Router();

// GET all timeline posts with pagination and filtering
router.get("/", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      status, 
      search, 
      year 
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Build query based on filters
    if (category) {
      query.category = category;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (year) {
      query.year = parseInt(year);
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } }
      ];
    }

    // Get total count for pagination
    const total = await db.collection("timeline_posts").countDocuments(query);
    
    // Get posts with pagination
    const posts = await db.collection("timeline_posts")
      .find(query)
      .sort({ year: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    // Add image URLs
    const postsWithUrls = posts.map(post => ({
      ...post,
      imageUrl: post.image ? getFileUrl(post.image) : null
    }));

    res.json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      posts: postsWithUrls
    });
  } catch (err) {
    console.error("Error fetching timeline posts:", err);
    res.status(500).json({ 
      success: false,
      message: "টাইমলাইন পোস্ট লোড করতে সমস্যা হয়েছে"
    });
  }
});

// GET single timeline post by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = new ObjectId(id);

    const post = await db.collection("timeline_posts").findOne({ _id: objectId });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "পোস্ট পাওয়া যায়নি"
      });
    }

    // Add image URL
    const postWithUrl = {
      ...post,
      imageUrl: post.image ? getFileUrl(post.image) : null
    };

    res.json({
      success: true,
      post: postWithUrl
    });
  } catch (err) {
    console.error("Error fetching timeline post:", err);
    res.status(500).json({ 
      success: false,
      message: "পোস্ট লোড করতে সমস্যা হয়েছে"
    });
  }
});

// POST create new timeline post
router.post("/", uploadSingle("image"), async (req, res) => {
  try {
    const { 
      title, 
      date, 
      description, 
      category, 
      location, 
      year, 
      status 
    } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "শিরোনাম প্রয়োজন"
      });
    }

    if (!date || !date.trim()) {
      return res.status(400).json({
        success: false,
        message: "তারিখ প্রয়োজন"
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "বর্ণনা প্রয়োজন"
      });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({
        success: false,
        message: "বিভাগ প্রয়োজন"
      });
    }

    if (!year || isNaN(parseInt(year))) {
      return res.status(400).json({
        success: false,
        message: "সঠিক বছর প্রয়োজন"
      });
    }

    // Check if category exists
    const categoryExists = await db.collection("timeline_categories")
      .findOne({ name: category.trim() });
    
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "বিভাগটি পাওয়া যায়নি"
      });
    }

    // Check if post with same title and date already exists
    const existingPost = await db.collection("timeline_posts")
      .findOne({ 
        title: title.trim(),
        date: date.trim()
      });
    
    if (existingPost) {
      return res.status(400).json({
        success: false,
        message: "এই শিরোনাম ও তারিখের পোস্ট ইতিমধ্যে বিদ্যমান"
      });
    }

    const newPost = {
      title: title.trim(),
      date: date.trim(),
      description: description.trim(),
      category: category.trim(),
      location: location ? location.trim() : "",
      year: parseInt(year),
      status: status || "খসড়া",
      image: req.file ? req.file.filename : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0,
      likes: 0
    };

    // Insert post
    const result = await db.collection("timeline_posts").insertOne(newPost);

    // Update category post count
    await db.collection("timeline_categories").updateOne(
      { name: category.trim() },
      { $inc: { postCount: 1 } }
    );

    res.status(201).json({
      success: true,
      message: "টাইমলাইন পোস্ট সফলভাবে তৈরি হয়েছে",
      postId: result.insertedId
    });
  } catch (err) {
    console.error("Error creating timeline post:", err);
    res.status(500).json({ 
      success: false,
      message: "পোস্ট তৈরি করতে সমস্যা হয়েছে"
    });
  }
});

// PUT update timeline post
router.put("/:id", uploadSingle("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = new ObjectId(id);
    
    const { 
      title, 
      date, 
      description, 
      category, 
      location, 
      year, 
      status 
    } = req.body;

    // Check if post exists
    const existingPost = await db.collection("timeline_posts")
      .findOne({ _id: objectId });
    
    if (!existingPost) {
      return res.status(404).json({
        success: false,
        message: "পোস্ট পাওয়া যায়নি"
      });
    }

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "শিরোনাম প্রয়োজন"
      });
    }

    if (!date || !date.trim()) {
      return res.status(400).json({
        success: false,
        message: "তারিখ প্রয়োজন"
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "বর্ণনা প্রয়োজন"
      });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({
        success: false,
        message: "বিভাগ প্রয়োজন"
      });
    }

    if (!year || isNaN(parseInt(year))) {
      return res.status(400).json({
        success: false,
        message: "সঠিক বছর প্রয়োজন"
      });
    }

    // Check if category exists
    const categoryExists = await db.collection("timeline_categories")
      .findOne({ name: category.trim() });
    
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "বিভাগটি পাওয়া যায়নি"
      });
    }

    // Check if another post with same title and date already exists
    const duplicatePost = await db.collection("timeline_posts")
      .findOne({ 
        title: title.trim(),
        date: date.trim(),
        _id: { $ne: objectId }
      });
    
    if (duplicatePost) {
      return res.status(400).json({
        success: false,
        message: "এই শিরোনাম ও তারিখের পোস্ট ইতিমধ্যে বিদ্যমান"
      });
    }

    // Prepare update data
    const updateData = {
      title: title.trim(),
      date: date.trim(),
      description: description.trim(),
      category: category.trim(),
      location: location ? location.trim() : "",
      year: parseInt(year),
      status: status || existingPost.status,
      updatedAt: new Date()
    };

    // Handle image update
    let oldImage = null;
    if (req.file) {
      // New image uploaded
      oldImage = existingPost.image;
      updateData.image = req.file.filename;
    }

    // Update post
    const result = await db.collection("timeline_posts").updateOne(
      { _id: objectId },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "পোস্ট আপডেট করা যায়নি"
      });
    }

    // Handle category post count update if category changed
    if (existingPost.category !== category.trim()) {
      // Decrement old category count
      await db.collection("timeline_categories").updateOne(
        { name: existingPost.category },
        { $inc: { postCount: -1 } }
      );

      // Increment new category count
      await db.collection("timeline_categories").updateOne(
        { name: category.trim() },
        { $inc: { postCount: 1 } }
      );
    }

    // Delete old image if new one uploaded
    if (oldImage && req.file) {
      deleteFile(oldImage);
    }

    res.json({
      success: true,
      message: "পোস্ট সফলভাবে আপডেট হয়েছে"
    });
  } catch (err) {
    console.error("Error updating timeline post:", err);
    res.status(500).json({ 
      success: false,
      message: "পোস্ট আপডেট করতে সমস্যা হয়েছে"
    });
  }
});

// DELETE timeline post
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = new ObjectId(id);

    // Check if post exists
    const post = await db.collection("timeline_posts").findOne({ _id: objectId });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "পোস্ট পাওয়া যায়নি"
      });
    }

    // Delete post
    const result = await db.collection("timeline_posts").deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "পোস্ট ডিলিট করা যায়নি"
      });
    }

    // Decrement category post count
    await db.collection("timeline_categories").updateOne(
      { name: post.category },
      { $inc: { postCount: -1 } }
    );

    // Delete associated image
    if (post.image) {
      deleteFile(post.image);
    }

    res.json({
      success: true,
      message: "পোস্ট সফলভাবে ডিলিট করা হয়েছে"
    });
  } catch (err) {
    console.error("Error deleting timeline post:", err);
    res.status(500).json({ 
      success: false,
      message: "পোস্ট ডিলিট করতে সমস্যা হয়েছে"
    });
  }
});

// PATCH update post status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const objectId = new ObjectId(id);

    if (!status || !["খসড়া", "প্রকাশিত", "মুলতুবি"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "সঠিক অবস্থা প্রয়োজন"
      });
    }

    const result = await db.collection("timeline_posts").updateOne(
      { _id: objectId },
      { 
        $set: { 
          status: status,
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "পোস্ট পাওয়া যায়নি"
      });
    }

    res.json({
      success: true,
      message: "পোস্টের অবস্থা সফলভাবে আপডেট হয়েছে"
    });
  } catch (err) {
    console.error("Error updating post status:", err);
    res.status(500).json({ 
      success: false,
      message: "পোস্টের অবস্থা আপডেট করতে সমস্যা হয়েছে"
    });
  }
});

// GET posts by category
router.get("/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 10 } = req.query;

    const posts = await db.collection("timeline_posts")
      .find({ 
        category: category,
        status: "প্রকাশিত" // Only published posts
      })
      .sort({ year: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    // Add image URLs
    const postsWithUrls = posts.map(post => ({
      ...post,
      imageUrl: post.image ? getFileUrl(post.image) : null
    }));

    res.json({
      success: true,
      posts: postsWithUrls
    });
  } catch (err) {
    console.error("Error fetching posts by category:", err);
    res.status(500).json({ 
      success: false,
      message: "পোস্ট লোড করতে সমস্যা হয়েছে"
    });
  }
});

export default router;