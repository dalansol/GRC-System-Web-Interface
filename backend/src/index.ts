import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import hallazgosRouter from "./routes/hallazgos";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", hallazgosRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});