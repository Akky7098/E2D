const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};

const registerUser = async (req, res) => {
  try {
    const { name, email, mobile, whatsappNumber, password, role, assignedShed } =
      req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const user = await User.create({
      name,
      email,
      mobile,
      whatsappNumber,
      password,
      role,
      assignedShed: assignedShed || null,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          whatsappNumber: user.whatsappNumber,
          role: user.role,
          assignedShed: user.assignedShed,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email?.toLowerCase().trim(),
      password,
      isActive: true,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          _id: user._id,
          id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          whatsappNumber: user.whatsappNumber,
          role: user.role,
          assignedShed: user.assignedShed,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMe = async (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
};