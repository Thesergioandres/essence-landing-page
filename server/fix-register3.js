const fs = require('fs');
const p = 'c:/Users/sergu/OneDrive/Desktop/MIS PROYECTOS PROFESIONALES/landing essence/react-tailwindcss/client/src/features/auth/pages/RegisterPage.tsx';
let c = fs.readFileSync(p, 'utf8');

const part1 = c.split('await authService.register(payload);');
if (part1.length > 1) {
  const part2 = part1[1].split('navigate(\"/register?step=plan\", { replace: true });');
  if (part2.length > 1) {
    const newMiddle = \"const authData = await authService.register(payload);\\n\" +
\"      const pendingUser = { name: trimmedName, email: trimmedEmail };\\n\" +
\"      if (authData.role === 'god') {\\n\" +
\"        setSuccess('Registro completado en modo Administrador Maestro.');\\n\" +
\"        navigate('/onboarding', { replace: true });\\n\" +
\"      } else {\\n\" +
\"        setRegisteredUser(pendingUser);\\n\" +
\"        sessionStorage.setItem(\\n\" +
\"          REGISTER_STEP_STORAGE_KEY,\\n\" +
\"          JSON.stringify(pendingUser)\\n\" +
\"        );\\n\" +
\"        setSuccess('Registro completado. Ahora elige tu plan para continuar.');\\n\" +
\"        navigate('/register?step=plan', { replace: true });\\n\" +
\"      }\";
    fs.writeFileSync(p, part1[0] + newMiddle + part2[1]);
    console.log(\"Success\");
  } else {
    console.log(\"no match 2\");
  }
} else {
  console.log(\"no match 1\");
}
