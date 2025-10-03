const bcrypt = require('bcryptjs');
const User = require('../models/user');

const createHardcodedAdmin = async () => {
  const user_id = 'ADMIN001';
  const email = 'ayeshamashiat01@gmail.com';

  const existingAdmin = await User.findOne({ email });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@123', 10); 
    const adminUser = new User({
      user_id,
      email,
      password_hash: hashedPassword,
      first_name: 'System',
      last_name: 'Admin',
      department: 'Administration',
      role: 'Admin'
    });

    await adminUser.save();
    console.log('✅ Hardcoded Admin created: ayeshamashiat01@gmail.com / Admin@123');
  } else {
    console.log('ℹ️ Admin: ayeshamashiat01@gmail.com / Admin@123');
  }
};

module.exports = createHardcodedAdmin;