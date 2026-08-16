// Validaciones compartidas entre controllers (auth, users, etc.)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valida el formato basico de un correo electronico
const validateEmailFormat = (email) => EMAIL_REGEX.test(email);

// Valida complejidad de la contrasena: minimo 8 caracteres, mayuscula,
// minuscula, numero y caracter especial.
const validatePasswordComplexity = (password) => {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&.#_-]/.test(password);
  const minLength = password.length >= 8;

  return hasLower && hasUpper && hasNumber && hasSpecial && minLength;
};

module.exports = { validateEmailFormat, validatePasswordComplexity };
