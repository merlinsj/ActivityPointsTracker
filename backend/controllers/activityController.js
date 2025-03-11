const Activity = require('../models/Activity');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// @desc    Submit a new activity
// @route   POST /api/activities
// @access  Private (Student)
exports.submitActivity = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a certificate'
      });
    }

    const { activityType, title, description, date, eventOrganizer, level } = req.body;

    // Get the student's class and department
    const student = await User.findById(req.user._id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Create activity
    const activity = await Activity.create({
      student: req.user._id,
      activityType,
      title,
      description,
      date,
      eventOrganizer: eventOrganizer || 'Not specified',
      level: level || 1,
      certificateFile: req.file.path,
      // Include student's class and department for easier filtering
      studentClass: student.class,
      studentDepartment: student.department
    });

    // Find teachers for this student's class and department
    const teachers = await User.find({
      role: 'teacher',
      department: student.department,
      class: student.class
    });

    const teacherCount = teachers.length;

    res.status(201).json({
      success: true,
      data: activity,
      teacherCount,
      message: `Activity submitted successfully! Your certificate will be reviewed by your teacher${teacherCount > 0 ? '' : ' (Note: No teacher is currently assigned to your class)'}.`
    });
  } catch (error) {
    // If there was an error and a file was uploaded, delete it
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get all activities for a student
// @route   GET /api/activities
// @access  Private (Student)
exports.getMyActivities = async (req, res) => {
  try {
    const activities = await Activity.find({ student: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: activities.length,
      data: activities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get all pending activities for a teacher
// @route   GET /api/activities/pending
// @access  Private (Teacher)
exports.getPendingActivities = async (req, res) => {
  try {
    // Find students in the teacher's class/department
    const teacherQuery = { 
      role: 'student',
      department: req.user.department
    };
    
    // If teacher has a class assigned, filter by that class too
    if (req.user.class) {
      teacherQuery.class = req.user.class;
    }
    
    const students = await User.find(teacherQuery)
      .select('_id name email rollNumber class semester department');

    const studentIds = students.map(student => student._id);

    // Find pending activities for these students
    const activities = await Activity.find({
      student: { $in: studentIds },
      status: 'pending'
    }).populate('student', 'name email rollNumber class semester department')
      .sort({ createdAt: -1 });

    // Count activities by status for statistics
    const approvedCount = await Activity.countDocuments({
      student: { $in: studentIds },
      status: 'approved'
    });

    const rejectedCount = await Activity.countDocuments({
      student: { $in: studentIds },
      status: 'rejected'
    });

    res.status(200).json({
      success: true,
      count: activities.length,
      stats: {
        pending: activities.length,
        approved: approvedCount,
        rejected: rejectedCount
      },
      data: activities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Review an activity (approve/reject)
// @route   PUT /api/activities/:id/review
// @access  Private (Teacher)
exports.reviewActivity = async (req, res) => {
  try {
    const { status, pointsAwarded, feedback } = req.body;

    // Find the activity
    let activity = await Activity.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }

    // Find the student
    const student = await User.findById(activity.student);

    // Check if the student is in the teacher's department
    if (student.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to review this activity'
      });
    }

    // Update activity
    activity = await Activity.findByIdAndUpdate(
      req.params.id,
      {
        status,
        pointsAwarded: status === 'approved' ? pointsAwarded : 0,
        feedback,
        reviewedBy: req.user._id,
        reviewedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).populate('student', 'name email');

    res.status(200).json({
      success: true,
      data: activity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get all activities (for superadmin)
// @route   GET /api/activities/all
// @access  Private (Superadmin)
exports.getAllActivities = async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate('student', 'name email rollNumber class department semester')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: activities.length,
      data: activities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Generate report for a department
// @route   GET /api/activities/report
// @access  Private (Teacher, Superadmin)
exports.generateReport = async (req, res) => {
  try {
    const { department, semester, status } = req.query;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    // Find students based on filters
    const studentQuery = { role: 'student' };
    
    if (department) {
      studentQuery.department = department;
    } else if (req.user.role === 'teacher') {
      // If teacher and no department specified, use teacher's department
      studentQuery.department = req.user.department;
    }
    
    if (semester) {
      studentQuery.semester = semester;
    }
    
    const students = await User.find(studentQuery).select('_id name rollNumber class semester department');
    const studentIds = students.map(student => student._id);
    
    // Add student filter to query
    query.student = { $in: studentIds };
    
    // Get activities
    const activities = await Activity.find(query)
      .populate('student', 'name rollNumber class semester department')
      .sort({ 'student.name': 1 });
    
    // Group activities by student
    const report = students.map(student => {
      const studentActivities = activities.filter(
        activity => activity.student._id.toString() === student._id.toString()
      );
      
      const totalPoints = studentActivities.reduce(
        (sum, activity) => sum + (activity.pointsAwarded || 0), 
        0
      );
      
      return {
        student: {
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          class: student.class,
          semester: student.semester,
          department: student.department
        },
        totalActivities: studentActivities.length,
        approvedActivities: studentActivities.filter(a => a.status === 'approved').length,
        pendingActivities: studentActivities.filter(a => a.status === 'pending').length,
        rejectedActivities: studentActivities.filter(a => a.status === 'rejected').length,
        totalPoints
      };
    });
    
    res.status(200).json({
      success: true,
      count: report.length,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
}; 