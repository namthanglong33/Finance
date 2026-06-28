import { Router, type IRouter } from "express";
import healthRouter from "./health";
import financialRouter from "./financial";
import authRouter from "./auth";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(requireAuth, financialRouter);

export default router;
