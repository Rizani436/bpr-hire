import { Sequelize } from "sequelize";
import db from "../../config/Database.js";
import Cabangkantor from "./CabangkantorModel.js";

const {DataTypes} = Sequelize;

const Pegawai = db.define ('pegawai', {
    No:{
        type: DataTypes.STRING(18),
        primaryKey: true,
        allowNull: false,
        validate:{
            notEmpty: true
        }
    },
    Nama_Pegawai:{
        type: DataTypes.STRING(50),
        allowNull: false,
        validate:{
            notEmpty: true,
            len:[3, 100]
        }
    },
    NRP:{
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    Nama_Jabatan:{
        type: DataTypes.STRING(100),
        allowNull: false,
        validate:{
            notEmpty: true,
            len:[3, 100]
        }
    },
    
    kode_kantor:{
        type: DataTypes.STRING(100),
        allowNull: false,
        validate:{
            notEmpty: true,
            len:[3, 100]
        },
        references: {
            model: Cabangkantor,
            key: "kode_kantor",
        },
    },
},{
    freezeTableName: true,
    timestamps: true,
});

Cabangkantor.hasMany(Pegawai, { foreignKey: "kode_kantor" });
Pegawai.belongsTo(Cabangkantor, { foreignKey: "kode_kantor" });

export default Pegawai;
