const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const keys = require('../../config/keys');
const passport = require('passport');
const path = require('path');

// Load input validation
const validateRegisterInput = require('../../validation/register');
const validateLoginInput = require('../../validation/login');

// Load user model
const User = require('../../models/user');

// @route   GET api/users/test
// @desc    Test users route
// @access  Public
router.get('/test', (req, res) => res.json({ msg: 'user works' }));

// @route   POST api/users/register
// @desc    Register user
// @access  Public
router.post('/register', (req, res) => {
  const { errors, isValid } = validateRegisterInput(req.body);

  // Validate input
  if (!isValid) {
    return res.status(400).json(errors);
  }

  User.findOne({ email: req.body.email }).then(user => {
    if (user) {
      errors.email = 'User already exists.';
      return res.status(400).json(errors);
    }
    const newUser = new User({
      name: req.body.name,
      email: req.body.email,
      avatar: '',
      password: req.body.password
    });

    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(newUser.password, salt, (err, hash) => {
        if (err) {
          throw err;
        }
        newUser.password = hash;
        newUser
          .save()
          .then(user => res.json(user))
          .catch(err => console.log(err));
      });
    });
  });
});

// @route   POST api/users/login
// @desc    Login user
// @access  Public
router.post('/login', (req, res) => {
  const { errors, isValid } = validateLoginInput(req.body);

  // Validate input
  if (!isValid) {
    return res.status(400).json(errors);
  }

  // Find user by email
  User.findOne({ email: req.body.email }).then(user => {
    // Check if user exists
    if (!user) {
      errors.email = 'User not found.';
      return res.status(404).json(errors);
    }

    // Check if password matches
    bcrypt.compare(req.body.password, user.password).then(isMatched => {
      if (isMatched) {
        // Create JWT payload
        const payload = { id: user.id, name: user.name, avatar: user.avatar };

        // Sign token
        jwt.sign(
          payload,
          keys.secretOrKey,
          { expiresIn: 360000 },
          (err, token) => {
            res.json({
              success: true,
              token
            });
          }
        );
      } else {
        errors.password = 'Incorrect password.';
        return res.status(400).json(errors);
      }
    });
  });
});

module.exports = router;
