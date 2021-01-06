package com.salesmanager.shop.transbank;

import java.io.IOException;

import cl.transbank.common.IntegrationType;
import cl.transbank.webpay.exception.TransactionCommitException;
import cl.transbank.webpay.exception.TransactionCreateException;
import cl.transbank.webpay.webpayplus.WebpayPlus;
import cl.transbank.webpay.webpayplus.model.WebpayPlusTransactionCommitResponse;
import cl.transbank.webpay.webpayplus.model.WebpayPlusTransactionCreateResponse;

public class WebPay {
	public WebPay() {
		WebpayPlus.Transaction.setCommerceCode("597055555532");
		WebpayPlus.Transaction.setApiKey("579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C");
		WebpayPlus.Transaction.setIntegrationType(IntegrationType.TEST);
	}

	public TransbankDTO generateTransaction(String buyOrder, String sessionId, double amount, String returnUrl) {
		TransbankDTO transbank = new TransbankDTO();
		try {
			final WebpayPlusTransactionCreateResponse preResponse = WebpayPlus.Transaction.create(buyOrder, sessionId,
					amount, returnUrl);

			
			transbank.setToken(preResponse.getToken());
			transbank.setUrl(preResponse.getUrl());
			return transbank;
		} catch (TransactionCreateException | IOException  e) {
			e.getStackTrace();
			transbank.setCodeError(1);
		}
		return transbank;
	}
	
	public void commitTransaction(String token) {
		try {
			final WebpayPlusTransactionCommitResponse response = WebpayPlus.Transaction.commit(token);
		} catch (TransactionCommitException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}
}
