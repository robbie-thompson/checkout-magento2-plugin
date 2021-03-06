/**
 * Checkout.com Magento 2 Payment module (https://www.checkout.com)
 *
 * Copyright (c) 2017 Checkout.com (https://www.checkout.com)
 * Author: David Fiaty | integration@checkout.com
 *
 * License GNU/GPL V3 https://www.gnu.org/licenses/gpl-3.0.en.html
 */

/*browser:true*/
/*global define*/

define(
    [
        'jquery',
        'CheckoutCom_Magento2/js/view/payment/method-renderer/cc-form',
        'CheckoutCom_Magento2/js/view/payment/adapter',
        'Magento_Checkout/js/model/quote',
        'Magento_Ui/js/model/messageList',
        'mage/url',
        'Magento_Checkout/js/action/set-payment-information',
        'Magento_Checkout/js/model/full-screen-loader',
        'Magento_Checkout/js/model/payment/additional-validators',
        'Magento_Checkout/js/checkout-data',
        'Magento_Checkout/js/model/address-converter',
        'Magento_Checkout/js/action/redirect-on-success',
        'mage/translate',
        'mage/cookies'
    ],
    function($, Component, CheckoutCom, quote, globalMessages, url, setPaymentInformationAction, fullScreenLoader, additionalValidators, checkoutData, addressConverter, redirectOnSuccessAction, t, customer) {
        'use strict';

        window.checkoutConfig.reloadOnBillingAddress = true;

        return Component.extend({
            defaults: {
                active: true,
                template: 'CheckoutCom_Magento2/payment/applepay',
                code: 'checkout_com_applepay',
                card_token_id: null,
                button_target: '#ckoApplePayButton',
                debug: false
            },

            /**
             * @returns {exports}
             */
            initialize: function(config, messageContainer) {
                this._super();
                this.initObservable();
                this.messageContainer = messageContainer || config.messageContainer || globalMessages;
                this.setEmailAddress();

                return this;
            },

            /**
             * @returns {exports}
             */
            initObservable: function () {
                this._super()
                    .observe('isHidden');

                return this;
            },

            /**
             * @returns {bool}
             */
            isVisible: function () {
                return this.isHidden(this.messageContainer.hasMessages());
            },

            /**
             * @returns {bool}
             */
            removeAll: function () {
                this.messageContainer.clear();
            },

            /**
             * @returns {void}
             */
            onHiddenChange: function (isHidden) {
                var self = this;
                // Hide message block if needed
                if (isHidden) {
                    setTimeout(function () {
                        $(self.selector).hide('blind', {}, 500)
                    }, 10000);
                }
            },

            /**
             * @returns {string}
             */
            getCode: function() {
                return CheckoutCom.getCodeApplePay();
            },

            /**
             * @returns {string}
             */
            getApplePayTitle: function() {
                return CheckoutCom.getPaymentConfigApplePay()['title'];
            },

            /**
             * @returns {bool}
             */
            isActive: function() {
                return CheckoutCom.getPaymentConfigApplePay()['isActive'];
            },

            /**
             * @returns {string}
             */
            getEmailAddress: function() {
                return window.checkoutConfig.customerData.email || quote.guestEmail || checkoutData.getValidatedEmailValue();
            },

            /**
             * @returns {void}
             */
            setEmailAddress: function() {
                var email = this.getEmailAddress();
                $.cookie('ckoEmail', email);
            },

            /**
             * @returns {string}
             */
            getPublicKey: function() {
                return CheckoutCom.getPaymentConfig()['public_key'];
            },

            /**
             * @returns {string}
             */
            getQuoteValue: function() {
                return CheckoutCom.getPaymentConfig()['quote_value'].toFixed(2);
            },

            /**
             * @returns {string}
             */
            getQuoteCurrency: function() {
                return CheckoutCom.getPaymentConfig()['quote_currency'];
            },

            /**
             * @returns {object}
             */
            getBillingAddress: function() {
                return quote.billingAddress();
            },

            /**
             * @returns {array}
             */
            getLineItems: function() {
                return [];
            },

            /**
             * @returns {array}
             */
            getSupportedNetworks: function() {
                return CheckoutCom.getPaymentConfigApplePay()['supportedNetworks'].split(',');
            },

            /**
             * @returns {array}
             */
            getSupportedCountries: function() {
                return CheckoutCom.getPaymentConfigApplePay()['supportedCountries'].split(',');
            },

            /**
             * @returns {array}
             */
            getMerchantCapabilities: function() {
                var output = ['supports3DS'];
                var capabilities = CheckoutCom.getPaymentConfigApplePay()['merchantCapabilities'].split(',');
                
                return output.concat(capabilities);
            },

            /**
             * @returns {void}
             */
            logEvent: function(data) {
                if (this.debug === true) {
                    console.log(data);
                }
            },

            /**
             * @returns {object}
             */
            performValidation: function(valURL) {
                var controllerUrl = url.build('checkout_com/payment/applepayvalidation');
                var validationUrl = controllerUrl + '?u=' + valURL;
                
                return new Promise(function(resolve, reject) {
                    var xhr = new XMLHttpRequest();
                    xhr.onload = function() {
                        var data = JSON.parse(this.responseText);
                        resolve(data);
                    };
                    xhr.onerror = reject;
                    xhr.open('GET', validationUrl);
                    xhr.send();
                });
            },

            /**
             * @returns {object}
             */
            sendChargeRequest: function(paymentData) {
                return new Promise(function(resolve, reject) {
                    $.ajax({
                        url: url.build('checkout_com/payment/applepayplaceorder'),
                        type: "POST",
                        data: paymentData,
                        success: function(data, textStatus, xhr) {
                            if (data.status === true) {
                                resolve(data.status);
                            }
                            else {
                                reject;
                            }
                        },
                        error: function(xhr, textStatus, error) {
                            reject;
                        } 
                    });
                });
            },

            /**
             * @returns {bool}
             */
            launchApplePay: function() {
                // Prepare the parameters
                var ap = CheckoutCom.getPaymentConfigApplePay();
                var self = this;

                // Set the debug mode
                self.debug = JSON.parse(ap['debugMode']);

                // Apply the button style
                $(self.button_target).addClass('apple-pay-button-' + ap['buttonStyle']);

                // Check if the session is available
                if (window.ApplePaySession) {
                    var merchantIdentifier = ap['merchantId'];
                    var promise = ApplePaySession.canMakePaymentsWithActiveCard(merchantIdentifier);
                    promise.then(function (canMakePayments) {
                        if (canMakePayments) {
                            $(self.button_target).css('display', 'block');
                        } else {   
                            $('#got_notactive').css('display', 'block');
                        }
                    });
                } else {
                    $('#notgot').css('display', 'block');
                }

                // Handle the events
                $(self.button_target).click(function(evt) {
                    // Validate T&C submission
                    if (!additionalValidators.validate()) {
                        return;
                    }

                    // Prepare the parameters
                    var runningTotal	     = self.getQuoteValue();
                    var billingAddress       = self.getBillingAddress();

                    // Build the payment request
                    var paymentRequest = {
                        currencyCode: CheckoutCom.getPaymentConfig()['quote_currency'],
                        countryCode: billingAddress.countryId,
                        total: {
                           label: ap['storeName'],
                           amount: runningTotal
                        },
                        supportedNetworks: self.getSupportedNetworks(),
                        merchantCapabilities: self.getMerchantCapabilities(),
                        supportedCountries: self.getSupportedCountries()
                    };

                    // Start the payment session
                    var session = new ApplePaySession(1, paymentRequest);

                    // Merchant Validation
                    session.onvalidatemerchant = function (event) {
                        self.logEvent(event);
                        var promise = self.performValidation(event.validationURL);
                        promise.then(function (merchantSession) {
                            session.completeMerchantValidation(merchantSession);
                        }); 
                    }

                    // Shipping contact
                    session.onshippingcontactselected = function(event) {  
                        self.logEvent(event);                                              
                        var status = ApplePaySession.STATUS_SUCCESS;

                        // Shipping info
                        var shippingOptions = [];                   
                        
                        var newTotal = {
                            type: 'final',
                            label: ap['storeName'],
                            amount: runningTotal
                        };
                        
                        session.completeShippingContactSelection(status, shippingOptions, newTotal, self.getLineItems());
                    }

                    // Shipping method selection
                    session.onshippingmethodselected = function(event) {   
                        self.logEvent(event);                                             
                        var status = ApplePaySession.STATUS_SUCCESS;
                        var newTotal = {
                            type: 'final',
                            label: ap['storeName'],
                            amount: runningTotal
                        };

                        session.completeShippingMethodSelection(status, newTotal, self.getLineItems());
                    }

                    // Payment method selection
                    session.onpaymentmethodselected = function(event) {
                        self.logEvent(event);
                        var newTotal = {
                            type: 'final',
                            label: ap['storeName'],
                            amount: runningTotal
                        };
                        
                        session.completePaymentMethodSelection(newTotal, self.getLineItems());
                    }

                    // Payment method authorization
                    session.onpaymentauthorized = function (event) {
                        self.logEvent(event);
                        var promise = self.sendChargeRequest(event.payment.token);
                        promise.then(function (success) {	
                            var status;
                            if (success) {
                                status = ApplePaySession.STATUS_SUCCESS;
                            } else {
                                status = ApplePaySession.STATUS_FAILURE;
                            }
                            
                            session.completePayment(status);

                            if (success) {
                                // redirect to success page
                                fullScreenLoader.startLoader();
                                redirectOnSuccessAction.execute(); 
                            }
                        });
                    }

                    // Session cancellation
                    session.oncancel = function(event) {
                        self.logEvent(event);
                    }

                    // Begin session
                    session.begin();
                });
            },
        });
    }
);