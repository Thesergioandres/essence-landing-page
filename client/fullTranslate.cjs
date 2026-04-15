const fs = require('fs');
const path = require('path');
function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, callback);
    else callback(p);
  });
}

const map = {
  '>Nuevo Employee<': '>Nuevo Empleado<',
  '> Employee <': '> Empleado <',
  '> Employees <': '> Empleados <',
  '>Employee<': '>Empleado<',
  '>Employees<': '>Empleados<',
  '> Nuevo Employee <': '> Nuevo Empleado <',
  '> Editar Employee <': '> Editar Empleado <',
  'Volver a employees': 'Volver a empleados',
  'Cargando employees': 'Cargando empleados',
  'No hay employees': 'No hay empleados',
  'crear nuevo employee': 'crear nuevo empleado',
  'Selecciona un employee': 'Selecciona un empleado',
  'Catalogo de employee': 'Catálogo de empleado',
  'del employee': 'del empleado',
  'el employee': 'el empleado',
  'al employee': 'al empleado',
  'un employee': 'un empleado',
  'los employees': 'los empleados',
  'las employees': 'las empleadas', // none of these probably
  'Total Employees': 'Total Empleados',
  'Ranking de Employees': 'Ranking de Empleados',
  'Employee ': 'Empleado ', // Wait, might break Employee { 
  'Employees ': 'Empleados ',
  ' employee ': ' empleado ',
  ' employees ': ' empleados ',
  'Empleado activado': 'Empleado activado',
  'Employee activado': 'Empleado activado',
  'Employee pausado': 'Empleado pausado',
  'Límite de employees': 'Límite de empleados',
  '>Employee<': '>Empleado<',
  '>Employees<': '>Empleados<',
  '"Employee"': '"Empleado"',
  '"Employees"': '"Empleados"',
  "'Employee'": "'Empleado'",
  "'Employees'": "'Empleados'",
  'ver employees': 'ver empleados',
  'cargar employees': 'cargar empleados',
  'Crear Employee': 'Crear Empleado',
  'creando employees': 'creando empleados',
  'Selecciona Employee': 'Selecciona Empleado',
  'Seleccionar Employee': 'Seleccionar Empleado',
  'Nombre del Employee': 'Nombre del Empleado',
  '>Employee<': '>Empleado<'
};

let modified = 0;
walk('./src', p => {
  if (!p.endsWith('.tsx') && !p.endsWith('.ts')) return;
  const content = fs.readFileSync(p, 'utf8');
  let newContent = content;
  
  for(const [k, v] of Object.entries(map)) {
     if (k.includes(' employee ') || k.includes(' employees ') || k.includes(' Employee ') || k.includes(' Employees ')) {
         // be careful
         if (newContent.includes(k)) {
             newContent = newContent.split(k).join(v);
         }
     } else {
         newContent = newContent.split(k).join(v);
     }
  }

  // Toast / Error / Success specific
  newContent = newContent.replace(/toast\.success\("([^"]+) employee([^"]+)"\)/g, 'toast.success(" empleado")');
  newContent = newContent.replace(/toast\.success\('([^']+) employee([^']+)'\)/g, "toast.success(' empleado')");
  newContent = newContent.replace(/setError\("([^"]+) employee([^"]+)"\)/g, 'setError(" empleado")');
  
  if (content !== newContent) {
     fs.writeFileSync(p, newContent);
     modified++;
  }
});
console.log('Modified', modified, 'files');
