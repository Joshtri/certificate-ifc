import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async()=>{
    try {
        const connect = await mongoose.connect(process.env.MONGODB_URI,{
            
        });

        console.log(`database connected. ${connect.connection.host}`);
    } catch (error) {
        console.log(error);
    }
};


export default connectDB;