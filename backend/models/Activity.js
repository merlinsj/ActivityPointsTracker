const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  activityType: {
    type: String,
    required: true,
    enum: [
      'Sports', 
      'Cultural', 
      'Technical', 
      'Professional Development', 
      'Community Service',
      'Other'
    ]
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  eventOrganizer: {
    type: String,
    default: 'Not specified'
  },
  level: {
    type: Number,
    min: 1,
    max: 5,
    default: 1
  },
  date: {
    type: Date,
    required: true
  },
  certificateFile: {
    type: String,  // Path to the uploaded certificate file
    required: true
  },
  // Additional fields for easier filtering
  studentClass: {
    type: String
  },
  studentDepartment: {
    type: String
  },
  pointsAwarded: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  feedback: {
    type: String
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Activity', ActivitySchema); 