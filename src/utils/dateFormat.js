// export const todayStr = () => {
//   return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
// }

export const todayStr = () => {
  const now = new Date();

  // Convert to IST (UTC + 5:30)
  const istTime = new Date(
    now.getTime() + (5 * 60 + 30) * 60 * 1000
  );

  const yyyy = istTime.getFullYear();
  const mm = String(istTime.getMonth() + 1).padStart(2, "0");
  const dd = String(istTime.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
};
