const sendResponse = ({
    res,
    statusCode = 200,
    success = true,
    message = '',
    data = null,
    pagination,
}) => {
    return res.status(statusCode).json({
        success,
        message,
        data,
        pagination
    });
};

module.exports = sendResponse;
