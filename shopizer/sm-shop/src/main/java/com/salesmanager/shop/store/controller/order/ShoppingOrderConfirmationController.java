package com.salesmanager.shop.store.controller.order;

import com.salesmanager.core.business.services.catalog.product.PricingService;
import com.salesmanager.core.business.services.catalog.product.ProductService;
import com.salesmanager.core.business.services.order.OrderService;
import com.salesmanager.core.business.services.order.orderproduct.OrderProductDownloadService;
import com.salesmanager.core.business.services.payments.PaymentService;
import com.salesmanager.core.business.services.reference.country.CountryService;
import com.salesmanager.core.business.services.reference.zone.ZoneService;
import com.salesmanager.core.business.services.shipping.ShippingService;
import com.salesmanager.core.business.services.shoppingcart.ShoppingCartService;
import com.salesmanager.core.model.merchant.MerchantStore;
import com.salesmanager.core.model.order.Order;
import com.salesmanager.core.model.order.orderproduct.OrderProductDownload;
import com.salesmanager.core.model.reference.country.Country;
import com.salesmanager.core.model.reference.language.Language;
import com.salesmanager.core.model.reference.zone.Zone;
import com.salesmanager.shop.constants.Constants;
import com.salesmanager.shop.model.order.ReadableOrderProductDownload;
import com.salesmanager.shop.model.order.ShopOrder;
import com.salesmanager.shop.model.order.v0.ReadableOrder;
import com.salesmanager.shop.populator.order.ReadableOrderProductDownloadPopulator;
import com.salesmanager.shop.store.controller.AbstractController;
import com.salesmanager.shop.store.controller.ControllerConstants;
import com.salesmanager.shop.store.controller.customer.facade.CustomerFacade;
import com.salesmanager.shop.store.controller.order.facade.OrderFacade;
import com.salesmanager.shop.store.controller.shoppingCart.facade.ShoppingCartFacade;
import com.salesmanager.shop.transbank.WebPay;
import com.salesmanager.shop.utils.LabelUtils;

import cl.transbank.webpay.webpayplus.model.WebpayPlusTransactionCommitResponse;

import org.apache.commons.collections4.CollectionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;

import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping(Constants.SHOP_URI + "/order")
public class ShoppingOrderConfirmationController extends AbstractController {

	private static final Logger LOGGER = LoggerFactory.getLogger(ShoppingOrderConfirmationController.class);

	@Inject
	private ShoppingCartFacade shoppingCartFacade;

	@Inject
	private ShoppingCartService shoppingCartService;

	@Inject
	private PaymentService paymentService;

	@Inject
	private ShippingService shippingService;

	@Inject
	private OrderService orderService;

	@Inject
	private ProductService productService;

	@Inject
	private CountryService countryService;

	@Inject
	private ZoneService zoneService;

	@Inject
	private OrderFacade orderFacade;

	@Inject
	private LabelUtils messages;

	@Inject
	private PricingService pricingService;

	@Inject
	private CustomerFacade customerFacade;

	@Inject
	private AuthenticationManager customerAuthenticationManager;

	@Inject
	private OrderProductDownloadService orderProdctDownloadService;
	
	@Autowired
	private  WebPay wp;

	/**
	 * Invoked once the payment is complete and order is fulfilled
	 * 
	 * @param model
	 * @param request
	 * @param response
	 * @param locale
	 * @return
	 * @throws Exception
	 */
	@RequestMapping("/confirmation.html")
	public String displayConfirmation(Model model, HttpServletRequest request, HttpServletResponse response,
			Locale locale, @ModelAttribute(value = "token_ws") String token) throws Exception {
		// llegara este parametro = token_ws


		 wp.commitTransaction(token);
//		Order modelOrder = orderService.getOr
//		orderService.saveOrUpdate(modelOrder);
		/** template **/
		StringBuilder template = new StringBuilder().append(ControllerConstants.Tiles.Checkout.confirmation).append(".")
				.append("december");
		return template.toString();

	}

}
