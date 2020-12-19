package com.salesmanager.shop.transbank;

public class TransbankDTO {

	
	private String token;
	private String url;
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
	
	
}
