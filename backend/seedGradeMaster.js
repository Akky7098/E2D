require("dotenv").config();
const mongoose = require("mongoose");
const GradeMaster = require("./src/models/GradeMaster");

const grades = [
  {
    standardGrade: "D2",
    category: "Tool Steel",
    aliases: ["D2", "1.2379", "DIN1.2379", "X153CRMO12", "X155CRVMO12-1", "SKD11", "K110", "CR12MOV"],
  },
  {
    standardGrade: "D3",
    category: "Tool Steel",
    aliases: ["D3", "1.2080", "DIN1.2080", "X210CR12", "SKD1", "CR12"],
  },
  {
    standardGrade: "OHNS",
    category: "Tool Steel",
    aliases: ["OHNS", "O1", "1.2510", "DIN1.2510", "100MNCRW4", "SKS3"],
  },
  {
    standardGrade: "H11",
    category: "Tool Steel",
    aliases: ["H11", "1.2343", "DIN1.2343", "X37CRMOV5-1", "SKD6"],
  },
  {
    standardGrade: "H13",
    category: "Tool Steel",
    aliases: ["H13", "1.2344", "DIN1.2344", "X40CRMOV5-1", "SKD61"],
  },
  {
    standardGrade: "DB6",
    category: "Tool Steel",
    aliases: ["DB6", "1.2714", "DIN1.2714", "55NICRMOV7", "L6"],
  },
  {
    standardGrade: "P20",
    category: "Plastic Mould Steel",
    aliases: ["P20", "1.2311", "DIN1.2311", "40CRMNMO7", "40CMD8"],
  },
  {
    standardGrade: "P20+NI",
    category: "Plastic Mould Steel",
    aliases: ["P20NI", "P20+NI", "P20+NICKEL", "1.2738", "DIN1.2738", "40CRMNNIMO8-6-4"],
  },
  {
    standardGrade: "EN24",
    category: "Alloy Steel",
    aliases: ["EN24", "817M40", "34CRNIMO6", "40NICRMO3", "4340", "SAE4340", "SNCM439"],
  },
  {
    standardGrade: "EN31",
    category: "Alloy Steel",
    aliases: ["EN31", "535A99", "100CR6", "52100", "SAE52100", "SUJ2"],
  },
  {
    standardGrade: "EN19",
    category: "Alloy Steel",
    aliases: ["EN19", "EN19C", "709M40", "42CRMO4", "42CRMOS4", "4140", "SAE4140", "SCM440"],
  },
  {
    standardGrade: "EN8D",
    category: "Alloy Steel",
    aliases: ["EN8D", "EN8", "080M40", "40C8", "C40", "CK40", "1040", "SAE1040"],
  },
  {
    standardGrade: "C45",
    category: "Alloy Steel",
    aliases: ["C45", "CK45", "1045", "SAE1045"],
  },
  {
    standardGrade: "SS304",
    category: "Stainless Steel",
    aliases: ["SS304", "304", "1.4301", "X5CRNI18-10"],
  },
  {
    standardGrade: "SS316",
    category: "Stainless Steel",
    aliases: ["SS316", "316", "1.4401", "1.4404"],
  },
  {
    standardGrade: "MS",
    category: "Carbon Steel",
    aliases: ["MS", "MILDSTEEL", "IS2062", "E250", "E350"],
  },
];

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    await GradeMaster.deleteMany({});

    await GradeMaster.insertMany(grades);

    console.log("Grade master seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("Grade master seed failed:", error);
    process.exit(1);
  }
};

run();