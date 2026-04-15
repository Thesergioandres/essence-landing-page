const fs = require('fs');
const p = 'c:/Users/sergu/OneDrive/Desktop/MIS PROYECTOS PROFESIONALES/landing essence/react-tailwindcss/client/src/features/auth/pages/RegisterPage.tsx';
let c = fs.readFileSync(p, 'utf8');

const part1 = c.split('await authService.register(payload);');
if (part1.length > 1) {
  const part2 = part1[1].split('navigate("/register?step=plan", { replace: true });');
  if (part2.length > 1) {
    const newMiddle = \const authData = await authService.register(payload);
      const pendingUser = { name: trimmedName, email: trimmedEmail };
      if (authData.role === 'god') {
        setSuccess('? Registro completado en modo Administrador Maestro.');
        navigate('/onboarding', { replace: true });
      } else {
        setRegisteredUser(pendingUser);
        sessionStorage.setItem(
          REGISTER_STEP_STORAGE_KEY,
          JSON.stringify(pendingUser)
        );
        setSuccess('? Registro completado. Ahora elige tu plan para continuar.');
        navigate('/register?step=plan', { replace: true });
      }\;
    fs.writeFileSync(p, part1[0] + newMiddle + part2[1]);
    console.log("Success");
  }
}
