// utils/createAdminUser.js
const bcrypt = require('bcryptjs');
const User = require('../models/user');

const createAdminUser = async () => {
  try {
    const adminEmail = 'ayeshamashiat01@gmail.com';
    const adminUserId = 'admin001';
    const adminFirstName = 'Super';
    const adminLastName = 'Admin';
    const adminDepartment = 'IT';
    const adminRole = 'Admin';
    const rawPassword = 'AdminPass123';  

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('Default admin user:');
      console.log('Email:', adminEmail);
      console.log('Password:', rawPassword);
      return;
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const adminUser = new User({
      user_id: adminUserId,
      email: adminEmail,
      password_hash: hashedPassword,
      first_name: adminFirstName,
      last_name: adminLastName,
      department: adminDepartment,
      program: 'System Admin',
      role: adminRole
    });

    await adminUser.save();

    console.log('Hardcoded admin user created:');
    console.log('Email:', adminEmail);
    console.log('Password:', rawPassword);
    console.log('PLEASE CHANGE THIS PASSWORD AFTER FIRST LOGIN!');
  } catch (err) {
    console.error('Error creating admin user:', err);
  }
};

module.exports = createAdminUser;
