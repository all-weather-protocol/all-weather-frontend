const openNotificationWithIcon = (api, title, type, msg) => {
  api[type]({
    message: title,
    description: msg,
    showProgress: true,
    pauseOnHover: true,
    duration: 1500000,
  });
};
export default openNotificationWithIcon;
