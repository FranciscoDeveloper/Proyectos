package com.salesmanager.shop.transbank;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class TransbankDTO {

	
	private String token;
	private String url;
	private int codeError;
	public String getToken() {
		return token;
	}
	public void setToken(String token) {
		this.token = token;
	}
	public String getUrl() {
		return url;
	}
	public void setUrl(String url) {
		this.url = url;
	}
	
	@Override
	public String toString(){
		return this.token;
	}
	public int getCodeError() {
		return codeError;
	}
	public void setCodeError(int codeError) {
		this.codeError = codeError;
	}
	
	
}
