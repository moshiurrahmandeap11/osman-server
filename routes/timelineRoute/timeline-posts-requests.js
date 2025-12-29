// routes/timeline-post-requests.js
import { Router } from "express";
import { ObjectId } from "mongodb";
import { db } from "../../db/connectDB.js";
import { deleteFile, getFileUrl, uploadSingle } from "../../middleware/upload.js";

const router = Router();

// GET all timeline post requests with pagination and filtering
router.get("/", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      search, 
      year 
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Build query based on filters
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
    const total = await db.collection("timeline_post_requests").countDocuments(query);
    
    // Get requests with pagination
    const requests = await db.collection("timeline_post_requests")
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    // Add image URLs
    const requestsWithUrls = requests.map(request => ({
      ...request,
      imageUrl: request.image ? getFileUrl(request.image) : null
    }));

    res.json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      requests: requestsWithUrls
    });
  } catch (err) {
    console.error("Error fetching timeline post requests:", err);
    res.status(500).json({ 
      success: false,
      message: "টাইমলাইন পোস্ট রিকোয়েস্ট লোড করতে সমস্যা হয়েছে"
    });
  }
});

// GET single timeline post request by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = new ObjectId(id);

    const request = await db.collection("timeline_post_requests").findOne({ _id: objectId });
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "রিকোয়েস্ট পাওয়া যায়নি"
      });
    }

    // Add image URL
    const requestWithUrl = {
      ...request,
      imageUrl: request.image ? getFileUrl(request.image) : null
    };

    res.json({
      success: true,
      request: requestWithUrl
    });
  } catch (err) {
    console.error("Error fetching timeline post request:", err);
    res.status(500).json({ 
      success: false,
      message: "রিকোয়েস্ট লোড করতে সমস্যা হয়েছে"
    });
  }
});

// POST create new timeline post request (from public form)
router.post("/", uploadSingle("image"), async (req, res) => {
  try {
    const { 
      title, 
      date, 
      description, 
      category, 
      location, 
      year, 
      submittedBy,
      email,
      phone
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

    let yearValue = 0;
    if (year && !isNaN(parseInt(year))) {
      yearValue = parseInt(year);
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

    const newRequest = {
      title: title.trim(),
      date: date.trim(),
      description: description.trim(),
      category: category.trim(),
      location: location ? location.trim() : "",
      year: yearValue,
      submittedBy: submittedBy ? submittedBy.trim() : "অজানা",
      email: email ? email.trim() : "",
      phone: phone ? phone.trim() : "",
      status: "pending", // pending, approved, rejected
      image: req.file ? req.file.filename : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: ""
    };

    // Insert request
    const result = await db.collection("timeline_post_requests").insertOne(newRequest);

    res.status(201).json({
      success: true,
      message: "টাইমলাইন পোস্ট রিকোয়েস্ট সফলভাবে জমা হয়েছে",
      requestId: result.insertedId
    });
  } catch (err) {
    console.error("Error creating timeline post request:", err);
    res.status(500).json({ 
      success: false,
      message: "রিকোয়েস্ট জমা করতে সমস্যা হয়েছে"
    });
  }
});

// PUT update timeline post request status (approve/reject)
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes, reviewedBy } = req.body;
    const objectId = new ObjectId(id);

    if (!status || !["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "সঠিক অবস্থা প্রয়োজন"
      });
    }

    // Check if request exists
    const request = await db.collection("timeline_post_requests")
      .findOne({ _id: objectId });
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "রিকোয়েস্ট পাওয়া যায়নি"
      });
    }

    // Prepare update data
    const updateData = {
      status: status,
      reviewNotes: reviewNotes || "",
      reviewedBy: reviewedBy || "এডমিন",
      reviewedAt: new Date(),
      updatedAt: new Date()
    };

    // If approved, create timeline post
    if (status === "approved") {
      // Check if category exists
      const categoryExists = await db.collection("timeline_categories")
        .findOne({ name: request.category });
      
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "বিভাগটি পাওয়া যায়নি"
        });
      }

      // Check if similar post already exists
      const existingPost = await db.collection("timeline_posts")
        .findOne({ 
          title: request.title,
          date: request.date
        });
      
      if (existingPost) {
        return res.status(400).json({
          success: false,
          message: "এই শিরোনাম ও তারিখের পোস্ট ইতিমধ্যে বিদ্যমান"
        });
      }

      // Create timeline post from request
      const timelinePost = {
        title: request.title,
        date: request.date,
        description: request.description,
        category: request.category,
        location: request.location,
        year: request.year,
        status: "প্রকাশিত",
        image: request.image,
        submittedBy: request.submittedBy,
        email: request.email,
        phone: request.phone,
        originalRequestId: request._id,
        createdAt: new Date(),
        updatedAt: new Date(),
        views: 0,
        likes: 0
      };

      // Insert into timeline posts
      await db.collection("timeline_posts").insertOne(timelinePost);

      // Update category post count
      await db.collection("timeline_categories").updateOne(
        { name: request.category },
        { $inc: { postCount: 1 } }
      );
    }

    // Update request status
    const result = await db.collection("timeline_post_requests").updateOne(
      { _id: objectId },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "রিকোয়েস্ট আপডেট করা যায়নি"
      });
    }

    res.json({
      success: true,
      message: `রিকোয়েস্ট ${status === 'approved' ? 'অনুমোদন' : 'বাতিল'} হয়েছে`
    });
  } catch (err) {
    console.error("Error updating timeline post request:", err);
    res.status(500).json({ 
      success: false,
      message: "রিকোয়েস্ট আপডেট করতে সমস্যা হয়েছে"
    });
  }
});

// DELETE timeline post request
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = new ObjectId(id);

    // Check if request exists
    const request = await db.collection("timeline_post_requests").findOne({ _id: objectId });
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "রিকোয়েস্ট পাওয়া যায়নি"
      });
    }

    // Delete request
    const result = await db.collection("timeline_post_requests").deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "রিকোয়েস্ট ডিলিট করা যায়নি"
      });
    }

    // Delete associated image
    if (request.image) {
      deleteFile(request.image);
    }

    res.json({
      success: true,
      message: "রিকোয়েস্ট সফলভাবে ডিলিট করা হয়েছে"
    });
  } catch (err) {
    console.error("Error deleting timeline post request:", err);
    res.status(500).json({ 
      success: false,
      message: "রিকোয়েস্ট ডিলিট করতে সমস্যা হয়েছে"
    });
  }
});

// GET pending requests count
router.get("/stats/count", async (req, res) => {
  try {
    const pendingCount = await db.collection("timeline_post_requests")
      .countDocuments({ status: "pending" });
    
    const approvedCount = await db.collection("timeline_post_requests")
      .countDocuments({ status: "approved" });
    
    const rejectedCount = await db.collection("timeline_post_requests")
      .countDocuments({ status: "rejected" });

    res.json({
      success: true,
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount
      }
    });
  } catch (err) {
    console.error("Error fetching request stats:", err);
    res.status(500).json({ 
      success: false,
      message: "স্ট্যাটিস্টিক্স লোড করতে সমস্যা হয়েছে"
    });
  }
});

export default router;