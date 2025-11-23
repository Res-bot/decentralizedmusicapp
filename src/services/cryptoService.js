export const generateSessionKeys = () => {
  const randomString = Math.random().toString(36).substring(2, 15);
  return {
    publicKey: `ed25519_pub_${randomString}`,
    privateKey: `ed25519_priv_${randomString}`,
  };
};

export const signRequest = (message, privateKey) => {
  return `sig_0x${Math.random().toString(16).slice(2)}...signed_by_${privateKey.substring(0, 8)}`;
};

export const simulateMetamaskLogin = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`0x${Math.random().toString(16).slice(2, 42)}`);
    }, 800);
  });
};