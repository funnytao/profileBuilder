const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const keys = require('../../config/keys');
const passport = require('passport');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const uuidv1 = require('uuid/v1');
const ResumeParser = require('resume-parser');

const isEmpty = require('../../validation/isEmpty');

const Profile = require('../../models/profile');

// @route   POST api/profiles/upload
// @desc    Upload Resume
// @access  Public
router.post('/upload', (req, res) => {
  const form = new formidable.IncomingForm();

  // Generate uuid as tmp folder name
  const uuid4File = uuidv1();

  // Download file to server
  form.parse(req, (err, fields, files) => {
    // Make new folder to store files
    const newFolder = path.resolve(__dirname, '../../resumes/', uuid4File);
    if (!fs.existsSync(newFolder)) {
      fs.mkdirSync(newFolder);
    }

    // Save file to folder
    const oldpath = files.resume.path;
    const newpath = path.resolve(
      __dirname,
      '../../resumes/',
      uuid4File,
      'origin.pdf'
    );
    fs.rename(oldpath, newpath, function(err) {
      if (err) {
        return res.status(400).json(err);
      }
      console.log('converting...');

      // Call python script to convert pdf to txt
      const spawn = require('child_process').spawn;
      const convertedPath = path.resolve(
        __dirname,
        '../../resumes/',
        uuid4File,
        'converted.txt'
      );
      const ls = spawn('python', [
        './python_scripts/bin/pdf_to_text.py',
        newpath,
        convertedPath
      ]);

      // Continue to analyze txt file after convertion
      ls.on('exit', () => {
        console.log('converted, start to analyze...');

        // Delete original pdf
        fs.unlinkSync(newpath);
        console.log('Deleted original resume!!');

        // Call python script to extract info from txt file
        let output = '';
        const extractPDF = spawn('python', [
          './python_scripts/src/main.py',
          './python_scripts/mining_resume/resume_config.xml',
          './resumes/' + uuid4File + '/'
        ]);

        // Record down system output
        extractPDF.stdout.on('data', data => {
          output += data;
        });

        extractPDF.on('exit', () => {
          // Get json object from python
          output = JSON.parse(output)[0];
          console.log(output);

          // Delete txt file and folder
          fs.unlinkSync(convertedPath);
          fs.rmdirSync(newFolder);

          // Save new profile to MongoDB
          let profileFields = {};

          if (!isEmpty(output.Metadata.NaMe)) {
            profileFields.name = output.Metadata.NaMe;
          }

          if (!isEmpty(output.Metadata.Email)) {
            profileFields.email = output.Metadata.Email;
          }

          if (!profileFields.email && !profileFields.name) {
            return res.status(400).json({ error: 'Cannot analyze resume.' });
          }

          if (!isEmpty(output.Metadata.Phone)) {
            profileFields.phone = output.Metadata.Phone;
          }

          if (!isEmpty(output.Education)) {
            profileFields.education = [];
            for (let key in output.Education) {
              profileFields.education.push({ title: output.Education[key] });
            }
          }

          Profile.findOne({ email: profileFields.email }).then(profile => {
            if (profile) {
              Profile.findOneAndUpdate(
                { email: profileFields.email },
                { $set: profileFields },
                { new: true }
              ).then(profile => res.json(profile));
            } else {
              new Profile(profileFields)
                .save()
                .then(() => {
                  return res.status(200).json(profileFields);
                })
                .catch(err =>
                  res.status(400).json({ error: 'Failed to save profile.' })
                );
            }
          });
        });
      });
    });
  });
});

// @route   POST api/profiles/upload
// @desc    Upload Resume
// @access  Public
router.post('/resume', (req, res) => {
  const form = new formidable.IncomingForm();

  // Generate uuid as tmp folder name
  const uuid4File = uuidv1();

  // Download file to server
  form.parse(req, (err, fields, files) => {
    // Make new folder to store files
    const newFolder = path.resolve(__dirname, '../../resumes/', uuid4File);
    if (!fs.existsSync(newFolder)) {
      fs.mkdirSync(newFolder);
    }

    // Save file to folder
    const oldpath = files.resume.path;
    const newpath = path.resolve(
      __dirname,
      '../../resumes/',
      uuid4File,
      'origin.pdf'
    );
    fs.rename(oldpath, newpath, function(err) {
      if (err) {
        return res.status(400).json(err);
      }
      console.log('converting...');

      // Call python script to convert pdf to txt
      const spawn = require('child_process').spawn;
      const convertedPath = path.resolve(
        __dirname,
        '../../resumes/',
        uuid4File,
        'converted.txt'
      );
      const ls = spawn('python', [
        './python_scripts/bin/pdf_to_text.py',
        newpath,
        convertedPath
      ]);

      // Continue to analyze txt file after convertion
      ls.on('exit', () => {
        console.log('converted, start to analyze...');

        // Delete original pdf
        fs.unlinkSync(newpath);
        console.log('Deleted original resume!!');

        // From file to file
        ResumeParser.parseResumeFile(convertedPath, newFolder)
          .then(file => {
            console.log('Yay! ' + file);
          })
          .catch(error => {
            console.error(error);
          });
      });
    });
  });
});

module.exports = router;
