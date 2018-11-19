<?php
/**
 * Checkout.com Magento 2 Payment module (https://www.checkout.com)
 *
 * Copyright (c) 2017 Checkout.com (https://www.checkout.com)
 * Author: David Fiaty | integration@checkout.com
 *
 * License GNU/GPL V3 https://www.gnu.org/licenses/gpl-3.0.en.html
 */

namespace CheckoutCom\Magento2\Controller\Payment;

use Magento\Framework\App\Action\Context;
use Magento\Checkout\Model\Session as CheckoutSession;
use Magento\Customer\Model\Session as CustomerSession;
use Magento\Quote\Model\QuoteManagement;
use CheckoutCom\Magento2\Gateway\Config\Config as GatewayConfig;
use Magento\Customer\Api\Data\GroupInterface;
use CheckoutCom\Magento2\Model\Ui\ConfigProvider;
use Magento\Sales\Model\Order\Payment\Transaction;
use Magento\Sales\Model\Order\Payment\Transaction\BuilderInterface;
use CheckoutCom\Magento2\Model\Service\TokenChargeService;

class ApplePayPlaceOrder extends AbstractAction {

    /**
     * @var TokenChargeService
     */
    protected $tokenChargeService;

    /**
     * @var CheckoutSession
     */
    protected $checkoutSession;

    /**
     * @var CustomerSession
     */
    protected $customerSession;

    /**
     * @var QuoteManagement
     */
    protected $quoteManagement;

    /**
     * PlaceOrder constructor.
     * @param Context $context
     * @param CheckoutSession $checkoutSession
     * @param GatewayConfig $gatewayConfig
     * @param QuoteManagement $quoteManagement
     * @param Order $orderManager
     */
    public function __construct(
        Context $context,
        CheckoutSession $checkoutSession,
        GatewayConfig $gatewayConfig,
        QuoteManagement $quoteManagement,
        CustomerSession $customerSession,
        TokenChargeService $tokenChargeService
    ) {
        parent::__construct($context, $gatewayConfig);

        $this->checkoutSession        = $checkoutSession;
        $this->customerSession        = $customerSession;
        $this->quoteManagement        = $quoteManagement;
        $this->tokenChargeService     = $tokenChargeService;
    }

    /**
     * Handles the controller method.
     *
     * @return \Magento\Framework\Controller\Result\Redirect
     */
    public function execute() {
        // Get the request parameters
        $params = $this->getRequest()->getParams();

        // Get the quote
        $quote = $this->checkoutSession->getQuote();

        // Send the charge request
        //$success = $this->tokenChargeService->sendApplePayChargeRequest($params, $quote);

        // If charge is successful, create order
        $orderId = $this->createOrder($quote);

        $writer = new \Zend\Log\Writer\Stream(BP . '/var/log/order.log');
        $logger = new \Zend\Log\Logger();
        $logger->addWriter($writer);
        $logger->info($orderId);
    }

    public function createOrder($quote) { 
        // Prepare the quote payment
        $quote->setPaymentMethod(ConfigProvider::CODE_APPLE_PAY);
        $quote->getPayment()->importData(array('method' => ConfigProvider::CODE_APPLE_PAY));

        // Prepare the inventory
        $quote->setInventoryProcessed(false);

        // Check for guest user quote
        if ($quote->getCustomerEmail() === null && $this->customerSession->isLoggedIn() === false)
        {
            $quote->setCustomerId(null)
            ->setCustomerEmail($quote->getBillingAddress()->getEmail())
            ->setCustomerIsGuest(true)
            ->setCustomerGroupId(GroupInterface::NOT_LOGGED_IN_ID);
        }
        
        // Create the order
        $order = $this->quoteManagement->submit($quote);

        if ($order) {
            $this->checkoutSession->setLastOrderId($order->getId())
                               ->setLastRealOrderId($order->getIncrementId())
                               ->setLastOrderStatus($order->getStatus());

            return $order->getId();
        }

       return false;
    }
}