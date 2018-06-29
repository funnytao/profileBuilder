const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const ProfileSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  education: [
    {
      title: {
        type: String,
        required: true
      }
    }
  ]
});

module.exports = Profile = mongoose.model('profiles', ProfileSchema);
