// timeline-categories.js (API route)
import { Router } from "express";
import { db } from "../../db/connectDB.js";

const router = Router();

// GET all categories
router.get("/", async (req, res) => {
  try {
    const categories = await db.collection("timeline_categories")
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({
      success: true,
      categories: categories
    });
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ 
      success: false,
      message: "বিভাগ লোড করতে সমস্যা হয়েছে"
    });
  }
});

// POST create new category
router.post("/", async (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "বিভাগের নাম প্রয়োজন"
      });
    }

    // Check if category already exists
    const existingCategory = await db.collection("timeline_categories")
      .findOne({ name: name.trim() });
    
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "এই বিভাগের নাম ইতিমধ্যে বিদ্যমান"
      });
    }

    const newCategory = {
      name: name.trim(),
      color: color || "bg-gray-100 text-gray-800",
      createdAt: new Date(),
      updatedAt: new Date(),
      postCount: 0
    };

    const result = await db.collection("timeline_categories")
      .insertOne(newCategory);

    res.status(201).json({
      success: true,
      message: "বিভাগ সফলভাবে যোগ করা হয়েছে",
      category: {
        id: result.insertedId,
        ...newCategory
      }
    });
  } catch (err) {
    console.error("Error creating category:", err);
    res.status(500).json({ 
      success: false,
      message: "বিভাগ তৈরি করতে সমস্যা হয়েছে"
    });
  }
});

// PUT update category
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "বিভাগের নাম প্রয়োজন"
      });
    }

    const objectId = new ObjectId(id);
    
    // Check if category exists
    const existingCategory = await db.collection("timeline_categories")
      .findOne({ _id: objectId });
    
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "বিভাগ পাওয়া যায়নি"
      });
    }

    // Check if new name already exists (excluding current category)
    const duplicateCategory = await db.collection("timeline_categories")
      .findOne({ 
        name: name.trim(),
        _id: { $ne: objectId }
      });
    
    if (duplicateCategory) {
      return res.status(400).json({
        success: false,
        message: "এই বিভাগের নাম ইতিমধ্যে বিদ্যমান"
      });
    }

    const updateData = {
      name: name.trim(),
      color: color || existingCategory.color,
      updatedAt: new Date()
    };

    const result = await db.collection("timeline_categories")
      .updateOne(
        { _id: objectId },
        { $set: updateData }
      );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "বিভাগ আপডেট করা যায়নি"
      });
    }

    res.json({
      success: true,
      message: "বিভাগ সফলভাবে আপডেট করা হয়েছে"
    });
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).json({ 
      success: false,
      message: "বিভাগ আপডেট করতে সমস্যা হয়েছে"
    });
  }
});

// DELETE category
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = new ObjectId(id);

    // Check if category is being used by any posts
    const postCount = await db.collection("timeline_posts")
      .countDocuments({ category: id });

    if (postCount > 0) {
      return res.status(400).json({
        success: false,
        message: "এই বিভাগটি কিছু পোস্টে ব্যবহৃত হচ্ছে, ডিলিট করা যাবে না"
      });
    }

    const result = await db.collection("timeline_categories")
      .deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "বিভাগ পাওয়া যায়নি"
      });
    }

    res.json({
      success: true,
      message: "বিভাগ সফলভাবে ডিলিট করা হয়েছে"
    });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ 
      success: false,
      message: "বিভাগ ডিলিট করতে সমস্যা হয়েছে"
    });
  }
});

export default router;