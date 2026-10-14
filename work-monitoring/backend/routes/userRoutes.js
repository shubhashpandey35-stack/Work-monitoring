import { Router } from "express";
import { getUsers, updateStatus, updateLocation } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = Router();

router.use(protect); // every route below needs a valid JWT

router.get("/", adminOnly, getUsers); // admin only
router.patch("/status", updateStatus); // logged-in employee
router.patch("/location", updateLocation); // logged-in employee

export default router;
