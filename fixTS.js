const fs = require('fs');
const path = require('path');
function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, callback);
    else callback(p);
  });
}
let mod = 0;
walk('./src', p => {
  if (!p.endsWith('.tsx') && !p.endsWith('.ts')) return;
  const content = fs.readFileSync(p, 'utf8');
  let c = content;
  
  c = c.replace(/\bisemployee\b/g, 'isEmployee');
  c = c.replace(/\bisemployees\b/g, 'isEmployees');
  c = c.replace(/\bIsEmployee\b/g, 'IsEmployee');
  c = c.replace(/\bIsemployee\b/g, 'IsEmployee');
  c = c.replace(/\bIsEMPLOYEE\b/g, 'IsEmployee');
  
  c = c.replace(/\ballowedEmpleados\b/g, 'allowedEmployees');
  c = c.replace(/\ballowedempleados\b/g, 'allowedEmployees');
  c = c.replace(/\bexistingAllowedempleados\b/g, 'existingAllowedEmployees');
  c = c.replace(/\bnormalizedAllowedempleados\b/g, 'normalizedAllowedEmployees');
  c = c.replace(/\bnormalizedAllowedEmpleados\b/g, 'normalizedAllowedEmployees');
  c = c.replace(/\ballowAllempleados\b/g, 'allowAllEmployees');
  c = c.replace(/\ballowAllEmpleados\b/g, 'allowAllEmployees');
  c = c.replace(/\bisGlobalemployees\b/g, 'isGlobalEmployees');
  c = c.replace(/\bisGlobalempleados\b/g, 'isGlobalEmployees');
  c = c.replace(/\bisGlobalEmpleados\b/g, 'isGlobalEmployees');
  c = c.replace(/\ballempleados\b/g, 'allEmployees');
  c = c.replace(/\ballEmpleados\b/g, 'allEmployees');

  c = c.replace(/\bemployeeNameSnapshot\b/g, 'employeeNameSnapshot'); // ensure casing
  c = c.replace(/\bTotalemployeeProfit\b/g, 'TotalEmployeeProfit');
  c = c.replace(/\btotalemployeeProfit\b/g, 'totalEmployeeProfit');
  c = c.replace(/\btotalemployeeCommissions\b/g, 'totalEmployeeCommissions');
  
  c = c.replace(/\b\.empleado\b/g, '.employee');
  c = c.replace(/\b\.empleadoId\b/g, '.employeeId');
  c = c.replace(/\b\.empleadoEmail\b/g, '.employeeEmail');
  c = c.replace(/\b\.empleadoName\b/g, '.employeeName');
  c = c.replace(/\b\.empleados\b/g, '.employees');

  if (c !== content) {
      fs.writeFileSync(p, c);
      mod++;
      console.log("Fixed ts errors in", p);
  }
});
console.log('Fixed', mod, 'files');
