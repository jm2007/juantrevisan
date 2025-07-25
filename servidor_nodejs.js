// server.js - Servidor Node.js con Express
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Configuración de multer para subida de archivos
const upload = multer({ 
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        // Solo acepta archivos Excel
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
        }
    }
});

// Middleware
app.use(express.static('public')); // Servir archivos estáticos
app.use(express.json());

// Ruta para subir y procesar Excel
app.post('/api/upload-excel', upload.single('excel'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        // Leer el archivo Excel
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Procesar datos
        const datosOperarios = {};
        let procesados = 0;

        jsonData.forEach(row => {
            const id = row.ID || row.id || row.Id;
            if (id) {
                datosOperarios[id.toString()] = {
                    nombre: row.Nombre || row.nombre || 'Sin nombre',
                    soldadura: (row.Soldadura || row.soldadura || 'No').toString(),
                    pintura: (row.Pintura || row.pintura || 'No').toString(),
                    montaje: (row.Montaje || row.montaje || 'No').toString(),
                    calidad: (row.Calidad || row.calidad || 'No').toString(),
                    electricidad: (row.Electricidad || row.electricidad || 'No').toString()
                };
                procesados++;
            }
        });

        // Guardar datos procesados en archivo JSON
        fs.writeFileSync('datos-operarios.json', JSON.stringify(datosOperarios, null, 2));

        // Limpiar archivo temporal
        fs.unlinkSync(req.file.path);

        res.json({ 
            success: true, 
            mensaje: `Excel procesado correctamente. ${procesados} operarios cargados.`,
            totalOperarios: procesados
        });

    } catch (error) {
        console.error('Error procesando Excel:', error);
        res.status(500).json({ error: 'Error procesando el archivo Excel' });
    }
});

// API para consultar operario por ID
app.get('/api/operario/:id', (req, res) => {
    try {
        const id = req.params.id;
        
        // Verificar si existe el archivo de datos
        if (!fs.existsSync('datos-operarios.json')) {
            return res.status(404).json({ error: 'No hay datos cargados. El supervisor debe cargar un Excel primero.' });
        }

        // Leer datos
        const datos = JSON.parse(fs.readFileSync('datos-operarios.json', 'utf8'));
        const operario = datos[id];

        if (!operario) {
            return res.status(404).json({ error: `No se encontró el operario con ID: ${id}` });
        }

        res.json({
            success: true,
            operario: {
                id: id,
                ...operario
            }
        });

    } catch (error) {
        console.error('Error consultando operario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// API para listar todos los operarios (solo para supervisor)
app.get('/api/operarios', (req, res) => {
    try {
        if (!fs.existsSync('datos-operarios.json')) {
            return res.json({ operarios: {} });
        }

        const datos = JSON.parse(fs.readFileSync('datos-operarios.json', 'utf8'));
        res.json({ operarios: datos });

    } catch (error) {
        console.error('Error listando operarios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Ruta para servir la página del supervisor
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Ruta para servir la página de operarios
app.get('/operario', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'operario.html'));
});

// Crear directorio uploads si no existe
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Crear directorio public si no existe
if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
}

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`📊 Panel supervisor: http://localhost:${PORT}/admin`);
    console.log(`👷 Página operarios: http://localhost:${PORT}/operario?id=123`);
});

// Manejo de errores de Multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError || error.message.includes('Solo se permiten')) {
        return res.status(400).json({ error: error.message });
    }
    next(error);
});