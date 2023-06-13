export interface cfEventRequest {
  Records: [
    {
      cf: {
        config: {
          distributionDomainName: string,
          distributionId: string,
          eventType: string,
          requestId: string
        },
        request: {
          body: {
            action: string,
            data: string,
            encoding: string,
            inputTruncated: boolean
          },
          clientIp: string,
          headers: {
            [key: string]: [
              {
                key: string,
                value: string
              }
            ]
          },
          method: string,
          querystring: string,
          uri: string
        }
      }
    }
  ]
}
