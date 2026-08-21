import { Sequelize } from "sequelize";
import db from "../../config/Database.js";

const {DataTypes} = Sequelize;

const Cabangkantor = db.define ('cabangkantor', {
    kode_kantor:{
        type: DataTypes.STRING(18),
        primaryKey: true,
        allowNull: false,
        validate:{
            notEmpty: true
        }
    },
    nama_kantor:{
        type: DataTypes.STRING(255),
        allowNull: false,
        validate:{
            notEmpty: true,
            len:[3, 255]
        }
    },
    longitude:{
        type: DataTypes.STRING(100),
        allowNull: false,
        validate:{
            notEmpty: true,
            len:[3, 100]
        }
    },
    latitude:{
        type: DataTypes.STRING(100),
        allowNull: false,
        validate:{
            notEmpty: true,
            len:[3, 100]
        }
    },
    
    alamatLengkap:{
        type: DataTypes.TEXT('long'),
        allowNull: false,
        validate:{
            notEmpty: true
        }
    },
},{
    freezeTableName: true,
    timestamps: true,
});

export default Cabangkantor;
