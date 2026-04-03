// src/config/db.js
import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const uri = process.env.DATABASE;
        const connectionInstance = await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`\n✅ MongoDB connected !!`);
        console.log(`📦 DB Name: ${connectionInstance.connection.name}`);
        console.log(`🌐 Host: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("❌ MONGODB connection FAILED", error);
        process.exit(1);
    }
};
