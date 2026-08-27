class ApiResponse {
  static success(res, data = null, message = 'Success', statusCode = 200, meta = undefined) {
    const body = { success: true, message, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  }

  static created(res, data, message = 'Created') {
    return ApiResponse.success(res, data, message, 201);
  }

  static paginated(res, items, pagination, message = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data: items,
      meta: { pagination },
    });
  }

  static noContent(res) {
    return res.status(204).send();
  }
}

module.exports = ApiResponse;
